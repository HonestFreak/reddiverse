import * as THREE from 'three';
import { TerrainGenerator } from '../../../shared/core/terrain/TerrainGenerator';
import { ChunkConfig, RenderConfig } from '../../../shared/config/gameConfig';
import { ChunkData, chunkKey, ChunkKey, indexOf } from './ChunkTypes';
import { buildSurfaceInstancedMesh, buildSnowOverlayInstancedMesh, buildWaterOverlayInstancedMesh } from './ChunkBuilder';
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
  // Tracks terrain cells (world coords) that have been removed by players
  private removedTerrainCells: Set<string> = new Set();

  private chunks: Map<ChunkKey, { data: ChunkData; mesh: THREE.InstancedMesh; outline?: THREE.LineSegments | undefined; snowMesh?: THREE.InstancedMesh | undefined; foliageMeshes?: THREE.InstancedMesh[] | undefined; foliageCells?: Set<string> | undefined }>; 
  private snowOverlay: { threshold: number; depth: number; blockId: string } | undefined;
  private waterMeshes: Map<ChunkKey, THREE.InstancedMesh> = new Map();

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

  async generateChunk(cx: number, cz: number): Promise<{ data: ChunkData; mesh: THREE.InstancedMesh; outline?: THREE.LineSegments | undefined; snowMesh?: THREE.InstancedMesh | undefined; foliageMeshes?: THREE.InstancedMesh[] | undefined; foliageCells?: Set<string> | undefined; waterMesh?: THREE.InstancedMesh | undefined }> {
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
    // Build the surface mesh, skipping any cells that have been removed
    const { mesh, outline } = await buildSurfaceInstancedMesh(
      data,
      this.renderConfig,
      this.blockFactory,
      this.surfaceBlockId,
      (wx: number, wy: number, wz: number) => this.removedTerrainCells.has(`${Math.round(wx)},${Math.round(wy)},${Math.round(wz)}`),
      { x: cx * sizeX, z: cz * sizeZ },
      (wx: number, wz: number) => this.getSurfaceHeightAt(wx, wz)
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
        this.snowOverlay.depth,
        (wx: number, wz: number) => this.getSurfaceHeightAt(wx, wz),
        { x: cx * sizeX, z: cz * sizeZ }
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

    // Optional water overlay for greenery terrain up to sea level
    let waterMesh: THREE.InstancedMesh | undefined = undefined;
    try {
      const isGreen = this.surfaceBlockId === 'grass';
      if (isGreen) {
        const seaLevel = 9;
        const waterOverlay = await buildWaterOverlayInstancedMesh(
          data,
          this.renderConfig,
          this.blockFactory,
          seaLevel,
          (wx: number, wz: number) => this.getSurfaceHeightAt(wx, wz),
          { x: cx * sizeX, z: cz * sizeZ }
        );
        if (waterOverlay) {
          waterOverlay.mesh.position.set(cx * sizeX * blockSize, 0, cz * sizeZ * blockSize);
          this.scene.add(waterOverlay.mesh);
          waterMesh = waterOverlay.mesh;
          this.waterMeshes.set(chunkKey(cx, cz), waterOverlay.mesh);
        }
      }
    } catch (e) {
      console.warn('water generation failed', e);
    }
    
    // Merge foliage cells into global set for fast reads each frame
    if (foliageCells) {
      for (const c of foliageCells) this.foliageCellsGlobal.add(c);
    }
    return { data, mesh, outline, snowMesh, foliageMeshes, foliageCells, waterMesh };
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
    for (const wm of this.waterMeshes.values()) result.push(wm);
    return result;
  }

  // Compute which chunk contains a world (x,z) coordinate
  private worldToChunk(wx: number, wz: number): { cx: number; cz: number } {
    const { sizeX, sizeZ } = this.chunkConfig;
    // Our chunks are positioned so that their local coordinates range from [-half, +half-1]
    // with world origin at the center of chunk (0,0). Convert world to chunk indices accordingly.
    const cx = Math.floor((Math.round(wx) + Math.floor(sizeX / 2)) / sizeX);
    const cz = Math.floor((Math.round(wz) + Math.floor(sizeZ / 2)) / sizeZ);
    return { cx, cz };
  }

  private async rebuildSurfaceMesh(cx: number, cz: number): Promise<void> {
    const key = chunkKey(cx, cz);
    const existing = this.chunks.get(key);
    if (!existing) return;
    // Remove old surface mesh and outline
    const oldSurface = existing.mesh;
    this.scene.remove(oldSurface);
    if (existing.outline) this.scene.remove(existing.outline);
    // Also remove and rebuild overlays that depend on surface height
    if (existing.snowMesh) { this.scene.remove(existing.snowMesh); existing.snowMesh = undefined; }
    const existingWater = this.waterMeshes.get(key);
    if (existingWater) { this.scene.remove(existingWater); this.waterMeshes.delete(key); }
    // Rebuild only the surface mesh using existing data, honoring removals
    const { data } = existing;
    const { sizeX, sizeZ, blockSize } = this.chunkConfig;
    const built = await buildSurfaceInstancedMesh(
      data,
      this.renderConfig,
      this.blockFactory,
      this.surfaceBlockId,
      (wx: number, wy: number, wz: number) => this.removedTerrainCells.has(`${Math.round(wx)},${Math.round(wy)},${Math.round(wz)}`),
      { x: cx * sizeX, z: cz * sizeZ },
      (wx: number, wz: number) => this.getSurfaceHeightAt(wx, wz)
    );
    built.mesh.position.set(cx * sizeX * blockSize, 0, cz * sizeZ * blockSize);
    this.scene.add(built.mesh);
    // eslint-disable-next-line no-console
    try {
      const oldCount = ((oldSurface as any).count as number) ?? ((oldSurface.instanceMatrix?.array?.length ?? 0) / 16);
      const newCount = ((built.mesh as any).count as number) ?? ((built.mesh.instanceMatrix?.array?.length ?? 0) / 16);
      console.log(`[ChunkManager] surface instances: ${oldCount} -> ${newCount} for chunk ${cx},${cz}`);
    } catch {}
    if (built.outline) {
      built.outline.position.set(cx * sizeX * blockSize, 0, cz * sizeZ * blockSize);
      this.scene.add(built.outline);
    }
    // Rebuild snow overlay if configured
    let snowMesh: THREE.InstancedMesh | undefined = undefined;
    if (this.snowOverlay) {
      const overlay = await buildSnowOverlayInstancedMesh(
        data,
        this.renderConfig,
        this.blockFactory,
        this.snowOverlay.blockId,
        this.snowOverlay.threshold,
        this.snowOverlay.depth,
        (wx: number, wz: number) => this.getSurfaceHeightAt(wx, wz),
        { x: cx * sizeX, z: cz * sizeZ }
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

    // Rebuild water overlay for greenery
    if (this.surfaceBlockId === 'grass') {
      const seaLevel = 9;
      const waterOverlay = await buildWaterOverlayInstancedMesh(
        data,
        this.renderConfig,
        this.blockFactory,
        seaLevel,
        (wx: number, wz: number) => this.getSurfaceHeightAt(wx, wz),
        { x: cx * sizeX, z: cz * sizeZ }
      );
      if (waterOverlay) {
        waterOverlay.mesh.position.set(cx * sizeX * blockSize, 0, cz * sizeZ * blockSize);
        this.scene.add(waterOverlay.mesh);
        this.waterMeshes.set(key, waterOverlay.mesh);
      }
    }

    // Update chunk entry preserving foliage
    this.chunks.set(key, { ...existing, mesh: built.mesh, outline: built.outline, snowMesh });
  }

  // Mark a terrain cell as removed and rebuild the containing chunk surface mesh
  async removeTerrainBlockAtWorld(wx: number, wy: number, wz: number): Promise<void> {
    const rx = Math.round(wx), ry = Math.round(wy), rz = Math.round(wz);
    // Debug logging
    // eslint-disable-next-line no-console
    console.log(`[ChunkManager] removeTerrainBlockAtWorld: request at ${rx},${ry},${rz}`);
    const beforeH = this.getSurfaceHeightAt(rx, rz);
    this.removedTerrainCells.add(`${rx},${ry},${rz}`);
    const afterH = this.getSurfaceHeightAt(rx, rz);
    // eslint-disable-next-line no-console
    console.log(`[ChunkManager] column (${rx},${rz}) height: ${beforeH} -> ${afterH} (removed y=${ry}, removed?=${this.removedTerrainCells.has(`${rx},${ry},${rz}`)})`);
    const { cx, cz } = this.worldToChunk(rx, rz);
    // eslint-disable-next-line no-console
    console.log(`[ChunkManager] rebuilding chunk ${cx},${cz} after removal`);
    await this.ensureChunk(cx, cz);
    await this.rebuildSurfaceMesh(cx, cz);
    // Also rebuild immediate neighbor chunks if the removed cell is on the chunk border to update adjacent faces visually
    const { sizeX, sizeZ } = this.chunkConfig;
    const halfX = Math.floor(sizeX / 2);
    const halfZ = Math.floor(sizeZ / 2);
    const localX = rx - cx * sizeX;
    const localZ = rz - cz * sizeZ;
    const atMinX = localX === -halfX;
    const atMaxX = localX === sizeX - halfX - 1;
    const atMinZ = localZ === -halfZ;
    const atMaxZ = localZ === sizeZ - halfZ - 1;
    const neighborCoords: Array<{ nx: number; nz: number }> = [];
    if (atMinX) neighborCoords.push({ nx: cx - 1, nz: cz });
    if (atMaxX) neighborCoords.push({ nx: cx + 1, nz: cz });
    if (atMinZ) neighborCoords.push({ nx: cx, nz: cz - 1 });
    if (atMaxZ) neighborCoords.push({ nx: cx, nz: cz + 1 });
    for (const n of neighborCoords) {
      await this.ensureChunk(n.nx, n.nz);
      await this.rebuildSurfaceMesh(n.nx, n.nz);
    }
    // eslint-disable-next-line no-console
    console.log(`[ChunkManager] chunk ${cx},${cz} rebuilt`);
  }

  // Returns whether the terrain is solid at a given world cell, accounting for removals
  isTerrainSolidAtWorld(wx: number, wy: number, wz: number): boolean {
    const rx = Math.round(wx), ry = Math.round(wy), rz = Math.round(wz);
    // If this exact cell was removed, it's not solid
    if (this.removedTerrainCells.has(`${rx},${ry},${rz}`)) return false;
    const base = this.terrain.heightAt(rx, rz);
    return ry <= base;
  }

  // Returns the current surface height (topmost solid y) after removals for a column
  getSurfaceHeightAt(wx: number, wz: number): number {
    const rx = Math.round(wx), rz = Math.round(wz);
    let h = this.terrain.heightAt(rx, rz);
    // If top is removed, drop until a non-removed cell. If everything down to 0 is removed, return -1.
    // If the top cell(s) were removed, step downward until a solid cell is found
    while (h >= 0 && this.removedTerrainCells.has(`${rx},${h},${rz}`)) { h -= 1; }
    // eslint-disable-next-line no-console
    // console.log(`[ChunkManager] getSurfaceHeightAt(${rx},${rz}) => ${h}`);
    return h;
  }
}


