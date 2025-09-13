import * as THREE from 'three';
import { TerrainGenerator } from '../../../shared/core/terrain/TerrainGenerator';
import { ChunkConfig, RenderConfig } from '../../../shared/config/gameConfig';
import { ChunkData, chunkKey, ChunkKey, indexOf } from './ChunkTypes';
import { buildSurfaceInstancedMesh, buildSnowOverlayInstancedMesh } from './ChunkBuilder';
import { Perlin2D } from '../../../shared/core/noise/Perlin';
import { BlockFactory } from '../blocks/BlockFactory';
import { BlockTypeRegistry } from '../../../shared/types/BlockTypes';

export class ChunkManager {
  private readonly terrain: TerrainGenerator;
  private readonly chunkConfig: ChunkConfig;
  private readonly renderConfig: RenderConfig;
  private readonly scene: THREE.Scene;
  private readonly blockFactory: BlockFactory;
  private readonly surfaceBlockId: string;
  private foliageNoise: Perlin2D;
  private readonly foliageDensityScale = 256; // higher => larger clusters
  private foliageCellsGlobal: Set<string> = new Set();

  private chunks: Map<ChunkKey, { data: ChunkData; mesh: THREE.InstancedMesh; outline?: THREE.LineSegments | undefined; snowMesh?: THREE.InstancedMesh | undefined; foliageMeshes?: THREE.InstancedMesh[] | undefined; foliageCells?: Set<string> | undefined }>; 
  private snowOverlay: { threshold: number; depth: number; blockId: string } | undefined;

  constructor(
    scene: THREE.Scene,
    terrain: TerrainGenerator,
    chunkConfig: ChunkConfig,
    renderConfig: RenderConfig,
    blockTypes: BlockTypeRegistry,
    surfaceBlockId: string = 'grass',
    snowOverlay?: { threshold: number; depth: number; blockId: string }
  ) {
    this.scene = scene;
    this.terrain = terrain;
    this.chunkConfig = chunkConfig;
    this.renderConfig = renderConfig;
    this.blockFactory = new BlockFactory(blockTypes);
    this.surfaceBlockId = surfaceBlockId;
    this.snowOverlay = snowOverlay;
    this.chunks = new Map();
    const seed = this.terrain.getSeed?.() ?? 0;
    this.foliageNoise = new Perlin2D((seed + 1013904223) >>> 0);
  }

  async generateChunk(cx: number, cz: number): Promise<{ data: ChunkData; mesh: THREE.InstancedMesh; outline?: THREE.LineSegments | undefined; snowMesh?: THREE.InstancedMesh | undefined; foliageMeshes?: THREE.InstancedMesh[] | undefined; foliageCells?: Set<string> | undefined }> {
    const { sizeX, sizeZ, blockSize } = this.chunkConfig;
    const heights = new Uint8Array(sizeX * sizeZ);

    // Fill heights using terrain heightAt in world coordinates
    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        const wx = cx * sizeX + x - Math.floor(sizeX / 2);
        const wz = cz * sizeZ + z - Math.floor(sizeZ / 2);
        const h = this.terrain.heightAt(wx, wz);
        heights[indexOf(x, z, sizeX)] = h;
      }
    }

    const data: ChunkData = { sizeX, sizeZ, blockSize, heights };
    const { mesh, outline } = await buildSurfaceInstancedMesh(
      data,
      this.renderConfig,
      this.blockFactory,
      this.surfaceBlockId
    );
    mesh.position.set(cx * sizeX * blockSize, 0, cz * sizeZ * blockSize);
    this.scene.add(mesh);
    
    // Procedural foliage placement (deterministic per chunk)
    let foliageMeshes: THREE.InstancedMesh[] | undefined = undefined;
    let foliageCells: Set<string> | undefined = undefined;
    try {
      const baseSeed = this.terrain.getSeed?.() ?? 0;
      const seeded = (x: number, z: number) => {
        let h = baseSeed + 13331 + x * 374761393 + z * 668265263;
        h = (h ^ (h >>> 13)) * 1274126177;
        h ^= h >>> 16;
        return Math.abs(h) / 0x7fffffff;
      };

      const surfaceId = this.surfaceBlockId;
      const isDesert = surfaceId === 'sand';
      const isGreen = surfaceId === 'grass';

      if (isDesert || isGreen) {
        // Clustered density using low-frequency Perlin
        const worldCenterX = cx * sizeX;
        const worldCenterZ = cz * sizeZ;
        const dn = this.foliageNoise.noise2D(worldCenterX / this.foliageDensityScale, worldCenterZ / this.foliageDensityScale);
        let density = (dn + 1) * 0.5; // 0..1
        density = Math.pow(density, isGreen ? 1.0 : 1.2); // slightly sparser in desert
        const maxPerChunk = isGreen ? 6 : 2; // doubled greenery density
        const expected = density * maxPerChunk;
        const baseCount = Math.floor(expected);
        const frac = expected - baseCount;
        const extra = (seeded(cx * 31 + cz * 73, cx * 131 + cz * 197) < frac) ? 1 : 0;
        const structuresToPlace = Math.min(maxPerChunk, baseCount + extra);

        if (structuresToPlace > 0) {
          const instancesAll: Array<{ position: THREE.Vector3; matrix: THREE.Matrix4; type: string }> = [];
          let localFoliageCells: Set<string> | undefined = undefined;
          for (let k = 0; k < structuresToPlace; k++) {
            // pick a good local spot
            let bestX = Math.floor(sizeX / 2);
            let bestZ = Math.floor(sizeZ / 2);
            let bestH = 0;
            for (let i = 0; i < 6; i++) {
              const rx = Math.floor(seeded(cx + i + k * 7, cz + k * 11) * sizeX);
              const rz = Math.floor(seeded(cx + k * 13, cz + i + k * 17) * sizeZ);
              const h = heights[indexOf(Math.min(Math.max(rx, 0), sizeX - 1), Math.min(Math.max(rz, 0), sizeZ - 1), sizeX)] ?? 0;
              if (h > bestH) { bestH = h; bestX = rx; bestZ = rz; }
            }
            const surfaceY = bestH;

            if (isGreen) {
              const treeModule = await import('../../../shared/core/foliage/tree_default');
              // pick a variant: small (50%), default (35%), big (15%)
              const r = seeded(cx + 101 + k * 37, cz + 211 + k * 41);
              const tree = r < 0.5
                ? (treeModule.tree_small as { dx: number; dy: number; dz: number; type: string }[])
                : r < 0.85
                  ? (treeModule.tree_default as { dx: number; dy: number; dz: number; type: string }[])
                  : (treeModule.tree_big as { dx: number; dy: number; dz: number; type: string }[]);
              for (const b of tree) {
                const position = new THREE.Vector3(
                  (bestX - Math.floor(sizeX / 2) + b.dx) * blockSize,
                  (surfaceY + 1 + b.dy) * blockSize,
                  (bestZ - Math.floor(sizeZ / 2) + b.dz) * blockSize
                );
                const matrix = new THREE.Matrix4();
                matrix.setPosition(position);
                instancesAll.push({ position, matrix, type: b.type });
                // Trunk collidable, leaves non-collidable
                if (b.type !== 'leaf') {
                  const worldCellX = cx * sizeX + (bestX - Math.floor(sizeX / 2) + b.dx);
                  const worldCellY = surfaceY + 1 + b.dy;
                  const worldCellZ = cz * sizeZ + (bestZ - Math.floor(sizeZ / 2) + b.dz);
                  localFoliageCells = localFoliageCells ?? new Set<string>();
                  localFoliageCells.add(`${Math.round(worldCellX)},${Math.round(worldCellY)},${Math.round(worldCellZ)}`);
                }
              }
            } else if (isDesert) {
              const v = seeded(cx + 17 + k * 19, cz + 23 + k * 29);
              const cactusModule = await import('../../../shared/core/foliage/cactus');
              const cactus = (v < 0.5 ? cactusModule.cactus_small : cactusModule.cactus_tall) as { dx: number; dy: number; dz: number; type: string }[];
              for (const b of cactus) {
                const position = new THREE.Vector3(
                  (bestX - Math.floor(sizeX / 2) + b.dx) * blockSize,
                  (surfaceY + 1 + b.dy) * blockSize,
                  (bestZ - Math.floor(sizeZ / 2) + b.dz) * blockSize
                );
                const matrix = new THREE.Matrix4();
                matrix.setPosition(position);
                instancesAll.push({ position, matrix, type: b.type });
                const worldCellX = cx * sizeX + (bestX - Math.floor(sizeX / 2) + b.dx);
                const worldCellY = surfaceY + 1 + b.dy;
                const worldCellZ = cz * sizeZ + (bestZ - Math.floor(sizeZ / 2) + b.dz);
                localFoliageCells = localFoliageCells ?? new Set<string>();
                localFoliageCells.add(`${Math.round(worldCellX)},${Math.round(worldCellY)},${Math.round(worldCellZ)}`);
              }
            }
          }
          if (localFoliageCells) {
            foliageCells = foliageCells ?? new Set<string>();
            for (const c of localFoliageCells) foliageCells.add(c);
          }

          if (instancesAll.length > 0) {
            const byType = new Map<string, Array<{ position: THREE.Vector3; matrix: THREE.Matrix4 }>>();
            for (const inst of instancesAll) {
              const arr = byType.get(inst.type) ?? [];
              arr.push({ position: inst.position, matrix: inst.matrix });
              byType.set(inst.type, arr);
            }
            for (const [typeId, arr] of byType) {
              const built = await this.blockFactory.createInstancedBlock(typeId, arr, { showCollisionOutlines: false });
              built.mesh.position.set(cx * sizeX * blockSize, 0, cz * sizeZ * blockSize);
              this.scene.add(built.mesh);
              if (!foliageMeshes) foliageMeshes = [];
              foliageMeshes.push(built.mesh);
              // do not add outlines for foliage
            }
          }
        }
      }
    } catch (e) {
      console.warn('foliage generation failed', e);
    }
    if (outline) {
      outline.position.set(cx * sizeX * blockSize, 0, cz * sizeZ * blockSize);
      this.scene.add(outline);
    }

    // Optional snow overlay
    let snowMesh: THREE.InstancedMesh | undefined = undefined;
    if (this.snowOverlay) {
      const overlay = await buildSnowOverlayInstancedMesh(
        data,
        this.renderConfig,
        this.blockFactory,
        this.snowOverlay.blockId,
        this.snowOverlay.threshold,
        this.snowOverlay.depth
      );
      if (overlay) {
        overlay.mesh.position.set(cx * sizeX * blockSize, 0, cz * sizeZ * blockSize);
        this.scene.add(overlay.mesh);
        snowMesh = overlay.mesh;
        if (overlay.outline) {
          overlay.outline.position.set(cx * sizeX * blockSize, 0, cz * sizeZ * blockSize);
          this.scene.add(overlay.outline);
        }
      }
    }
    
    // Merge foliage cells into global set for fast reads each frame
    if (foliageCells) {
      for (const c of foliageCells) this.foliageCellsGlobal.add(c);
    }
    return { data, mesh, outline, snowMesh, foliageMeshes, foliageCells };
  }

  async ensureChunk(cx: number, cz: number): Promise<void> {
    const key = chunkKey(cx, cz);
    if (this.chunks.has(key)) return;
    const created = await this.generateChunk(cx, cz);
    this.chunks.set(key, created);
  }

  getFoliageCollisionCells(): Set<string> {
    return this.foliageCellsGlobal;
  }

  getAllTerrainMeshes(): THREE.InstancedMesh[] {
    const result: THREE.InstancedMesh[] = [];
    for (const c of this.chunks.values()) {
      result.push(c.mesh);
      if (c.snowMesh) result.push(c.snowMesh);
      if (c.foliageMeshes) result.push(...c.foliageMeshes);
    }
    return result;
  }
}


