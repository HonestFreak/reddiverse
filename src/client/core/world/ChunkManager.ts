import * as THREE from 'three';
import { TerrainGenerator } from '../../../shared/core/terrain/TerrainGenerator';
import { ChunkConfig, RenderConfig } from '../../../shared/config/gameConfig';
import { ChunkData, chunkKey, ChunkKey, indexOf } from './ChunkTypes';
import { buildSurfaceInstancedMesh } from './ChunkBuilder';

export class ChunkManager {
  private readonly terrain: TerrainGenerator;
  private readonly chunkConfig: ChunkConfig;
  private readonly renderConfig: RenderConfig;
  private readonly scene: THREE.Scene;

  private chunks: Map<ChunkKey, { data: ChunkData; mesh: THREE.InstancedMesh; outline?: THREE.LineSegments | undefined }>; 

  constructor(
    scene: THREE.Scene,
    terrain: TerrainGenerator,
    chunkConfig: ChunkConfig,
    renderConfig: RenderConfig
  ) {
    this.scene = scene;
    this.terrain = terrain;
    this.chunkConfig = chunkConfig;
    this.renderConfig = renderConfig;
    this.chunks = new Map();
  }

  generateChunk(cx: number, cz: number): { data: ChunkData; mesh: THREE.InstancedMesh; outline?: THREE.LineSegments | undefined } {
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
    const { mesh, outline } = buildSurfaceInstancedMesh(data, this.renderConfig);
    mesh.position.set(cx * sizeX * blockSize, 0, cz * sizeZ * blockSize);
    this.scene.add(mesh);
    
    if (outline) {
      outline.position.set(cx * sizeX * blockSize, 0, cz * sizeZ * blockSize);
      this.scene.add(outline);
    }
    
    return { data, mesh, outline };
  }

  ensureChunk(cx: number, cz: number): void {
    const key = chunkKey(cx, cz);
    if (this.chunks.has(key)) return;
    const created = this.generateChunk(cx, cz);
    this.chunks.set(key, created);
  }

  getAllTerrainMeshes(): THREE.InstancedMesh[] {
    return Array.from(this.chunks.values()).map(chunk => chunk.mesh);
  }
}


