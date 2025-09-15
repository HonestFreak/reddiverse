import * as THREE from 'three';
import { TerrainGenerator } from '../../../shared/core/terrain/TerrainGenerator';
import { ChunkConfig, RenderConfig } from '../../../shared/config/gameConfig';
import { ChunkData3D, chunkKey, ChunkKey, indexOf } from './ChunkTypes';
import { buildVoxelInstancedMeshes } from './ChunkBuilder';
import { Perlin2D } from '../../../shared/core/noise/Perlin';
import { BlockFactory } from '../blocks/BlockFactory';
import { BlockTypeRegistry } from '../../../shared/types/BlockTypes';

export class ChunkManager {
  private readonly terrain: TerrainGenerator;
  private readonly chunkConfig: ChunkConfig;
  private readonly renderConfig: RenderConfig;
  private readonly scene: THREE.Scene;
  private readonly blockFactory: BlockFactory;
  // surfaceBlockId removed; biome now derived from TerrainGenerator
  private foliageNoise: Perlin2D;
  private readonly foliageDensityScale = 256; // higher => larger clusters
  private foliageCellsGlobal: Set<string> = new Set();
  // Tracks terrain cells (world coords) that have been removed by players
  private removedTerrainCells: Set<string> = new Set();

  private chunks: Map<ChunkKey, { data3d: ChunkData3D; meshesByType: Map<string, THREE.InstancedMesh>; outline?: THREE.LineSegments | undefined; snowMesh?: THREE.InstancedMesh | undefined; foliageMeshes?: THREE.InstancedMesh[] | undefined; foliageCells?: Set<string> | undefined }>; 
  private snowOverlay: { threshold: number; depth: number; blockId: string } | undefined;

  constructor(
    scene: THREE.Scene,
    terrain: TerrainGenerator,
    chunkConfig: ChunkConfig,
    renderConfig: RenderConfig,
    blockTypes: BlockTypeRegistry,
    snowOverlay?: { threshold: number; depth: number; blockId: string }
  ) {
    this.scene = scene;
    this.terrain = terrain;
    this.chunkConfig = chunkConfig;
    this.renderConfig = renderConfig;
    this.blockFactory = new BlockFactory(blockTypes);
    this.snowOverlay = snowOverlay; // retained for future overlays
    this.chunks = new Map();
    const seed = this.terrain.getSeed?.() ?? 0;
    this.foliageNoise = new Perlin2D((seed + 1013904223) >>> 0);
  }

  async generateChunk(cx: number, cz: number): Promise<{ data3d: ChunkData3D; meshesByType: Map<string, THREE.InstancedMesh>; outline?: THREE.LineSegments | undefined; snowMesh?: THREE.InstancedMesh | undefined; foliageMeshes?: THREE.InstancedMesh[] | undefined; foliageCells?: Set<string> | undefined }> {
    const { sizeX, sizeZ, blockSize } = this.chunkConfig;
    const sizeY = Math.max(1, (this.chunkConfig as any).sizeY ?? (this.terrain.getMaxHeight() + 16));

    const generated = this.terrain.generateChunkVoxels(cx, cz, { sizeX, sizeZ, sizeY });
    const data3d: ChunkData3D = { sizeX, sizeY, sizeZ, blockSize, voxels: generated.voxels, heights: generated.heights } as any;

    // Build instanced meshes for voxels
    const built = await buildVoxelInstancedMeshes(
      data3d,
      this.renderConfig,
      this.blockFactory,
      (wx: number, wy: number, wz: number) => this.removedTerrainCells.has(`${Math.round(wx)},${Math.round(wy)},${Math.round(wz)}`),
      { x: cx * sizeX, z: cz * sizeZ }
    );
    const meshesByType = built.meshes;
    for (const m of meshesByType.values()) {
      m.position.set(cx * sizeX * blockSize, 0, cz * sizeZ * blockSize);
      this.scene.add(m);
    }
    
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

      // Sample biome using climate at chunk center
      const worldCenterX = cx * sizeX;
      const worldCenterZ = cz * sizeZ;
      const climate = this.terrain.getBiomeAt?.(worldCenterX, worldCenterZ) ?? 'greenery';
      const isDesert = climate === 'desert';
      const isGreen = climate === 'greenery' || climate === 'mountain' || climate === 'snow';
      const hasSnowOverlay = climate === 'snow' || !!this.snowOverlay;

      if (isDesert || isGreen) {
        // Density uses noise, modulated by biome
        const dn = this.foliageNoise.noise2D(worldCenterX / this.foliageDensityScale, worldCenterZ / this.foliageDensityScale);
        let density = (dn + 1) * 0.5; // 0..1
        // Biome multiplier
        const biomeMult = isDesert ? 0.25 : (hasSnowOverlay ? 0.5 : 1.0);
        density = Math.pow(density, isGreen ? 1.0 : 1.4) * biomeMult;
        const maxPerChunk = isDesert ? 3 : (hasSnowOverlay ? 3 : 7);
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
              const h = generated.heights[indexOf(Math.min(Math.max(rx, 0), sizeX - 1), Math.min(Math.max(rz, 0), sizeZ - 1), sizeX)] ?? 0;
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
    // No separate outline/snow/water overlays in voxel mode for now
    let snowMesh: THREE.InstancedMesh | undefined = undefined;
    
    // Merge foliage cells into global set for fast reads each frame
    if (foliageCells) {
      for (const c of foliageCells) this.foliageCellsGlobal.add(c);
    }
    return { data3d, meshesByType, outline: undefined, snowMesh, foliageMeshes, foliageCells };
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
      for (const m of c.meshesByType.values()) result.push(m);
      if (c.snowMesh) result.push(c.snowMesh);
      if (c.foliageMeshes) result.push(...c.foliageMeshes);
    }
    return result;
  }

  // Compute which chunk contains a world (x,z) coordinate
  private worldToChunk(wx: number, wz: number): { cx: number; cz: number } {
    const { sizeX, sizeZ } = this.chunkConfig;
    // Chunks are positioned so that chunk (0,0) contains world origin (0,0) at its center
    // World coordinates: chunk (cx,cz) spans from (cx*sizeX - sizeX/2) to (cx*sizeX + sizeX/2 - 1)
    // So: wx >= cx*sizeX - sizeX/2  =>  cx >= (wx + sizeX/2) / sizeX
    const cx = Math.floor((wx + Math.floor(sizeX / 2)) / sizeX);
    const cz = Math.floor((wz + Math.floor(sizeZ / 2)) / sizeZ);
    return { cx, cz };
  }

  private async rebuildVoxelMeshes(cx: number, cz: number): Promise<void> {
    const key = chunkKey(cx, cz);
    const existing = this.chunks.get(key);
    if (!existing) return;
    // Remove old meshes
    let oldInstanceTotal = 0;
    for (const m of existing.meshesByType.values()) {
      try {
        oldInstanceTotal += ((m as any).count as number) ?? ((m.instanceMatrix?.array?.length ?? 0) / 16);
      } catch {}
      this.scene.remove(m);
    }
    if (existing.outline) this.scene.remove(existing.outline);
    if (existing.snowMesh) { this.scene.remove(existing.snowMesh); existing.snowMesh = undefined; }

    const { data3d } = existing;
    const { sizeX } = data3d;
    const { blockSize } = this.chunkConfig;
    const built = await buildVoxelInstancedMeshes(
      data3d,
      this.renderConfig,
      this.blockFactory,
      (wx: number, wy: number, wz: number) => this.removedTerrainCells.has(`${Math.round(wx)},${Math.round(wy)},${Math.round(wz)}`),
      { x: cx * sizeX, z: cz * data3d.sizeZ }
    );
    let newInstanceTotal = 0;
    for (const m of built.meshes.values()) {
      m.position.set(cx * sizeX * blockSize, 0, cz * data3d.sizeZ * blockSize);
      this.scene.add(m);
      try {
        newInstanceTotal += ((m as any).count as number) ?? ((m.instanceMatrix?.array?.length ?? 0) / 16);
      } catch {}
    }
    existing.meshesByType = built.meshes;
    this.chunks.set(key, existing);
    // eslint-disable-next-line no-console
    console.log(`[ChunkManager] rebuilt chunk ${cx},${cz}: instances ${oldInstanceTotal} -> ${newInstanceTotal}`);
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
    console.log(`[ChunkManager] rebuilding chunk ${cx},${cz} after removal (local approx x=${rx - cx * this.chunkConfig.sizeX + Math.floor(this.chunkConfig.sizeX/2)}, z=${rz - cz * this.chunkConfig.sizeZ + Math.floor(this.chunkConfig.sizeZ/2)})`);
    await this.ensureChunk(cx, cz);
    await this.rebuildVoxelMeshes(cx, cz);
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
      await this.rebuildVoxelMeshes(n.nx, n.nz);
    }
    // eslint-disable-next-line no-console
    console.log(`[ChunkManager] chunk ${cx},${cz} rebuilt`);
  }

  // Returns whether the terrain is solid at a given world cell, accounting for removals
  isTerrainSolidAtWorld(wx: number, wy: number, wz: number): boolean {
    const rx = Math.round(wx), ry = Math.round(wy), rz = Math.round(wz);
    if (this.removedTerrainCells.has(`${rx},${ry},${rz}`)) return false;
    const { cx, cz } = this.worldToChunk(rx, rz);
    const key = chunkKey(cx, cz);
    const entry = this.chunks.get(key);
    if (!entry) {
      // Fallback to height-based solidity if chunk not yet built
      const base = this.terrain.heightAt(rx, rz);
      return ry <= base;
    }
    const { data3d } = entry;
    const localX = rx - cx * data3d.sizeX + Math.floor(data3d.sizeX / 2);
    const localZ = rz - cz * data3d.sizeZ + Math.floor(data3d.sizeZ / 2);
    if (localX < 0 || localZ < 0 || localX >= data3d.sizeX || localZ >= data3d.sizeZ || ry < 0 || ry >= data3d.sizeY) return false;
    const vi = (localZ * data3d.sizeX * data3d.sizeY) + (ry * data3d.sizeX) + localX;
    const kind = entry.data3d.voxels[vi];
    // Non-air and non-removed is solid (treat water as non-solid for gameplay?)
    return kind !== 0 && kind !== 5;
  }

  // Returns the current surface height (topmost solid y) after removals for a column
  getSurfaceHeightAt(wx: number, wz: number): number {
    const rx = Math.round(wx), rz = Math.round(wz);
    const { cx, cz } = this.worldToChunk(rx, rz);
    const entry = this.chunks.get(chunkKey(cx, cz));
    let baseH: number;
    if (entry) {
      const data3d = entry.data3d;
      const localX = rx - cx * data3d.sizeX + Math.floor(data3d.sizeX / 2);
      const localZ = rz - cz * data3d.sizeZ + Math.floor(data3d.sizeZ / 2);
      if (localX < 0 || localZ < 0 || localX >= data3d.sizeX || localZ >= data3d.sizeZ) {
        baseH = this.terrain.heightAt(rx, rz);
      } else {
        baseH = data3d.heights[indexOf(localX, localZ, data3d.sizeX)] ?? this.terrain.heightAt(rx, rz);
      }
    } else {
      baseH = this.terrain.heightAt(rx, rz);
    }
    let h = baseH;
    while (h >= 0 && this.removedTerrainCells.has(`${rx},${h},${rz}`)) { h -= 1; }
    return h;
  }
}


