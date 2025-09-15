import * as THREE from 'three';
import { ChunkData, indexOf, ChunkData3D, VoxelKind, voxelIndex, voxelToBlockId } from './ChunkTypes';
import { RenderConfig } from '../../../shared/config/gameConfig';
import { BlockFactory } from '../blocks/BlockFactory';

export type BuildResult = {
  mesh: THREE.InstancedMesh;
  outline?: THREE.LineSegments;
};

export async function buildSurfaceInstancedMesh(
  chunk: ChunkData,
  render: RenderConfig,
  blockFactory: BlockFactory,
  blockTypeId: string = 'grass',
  isBlockRemoved?: (wx: number, wy: number, wz: number) => boolean,
  chunkWorldPos?: { x: number; z: number },
  getSurfaceHeightAtWorld?: (wx: number, wz: number) => number
): Promise<BuildResult> {
  const { sizeX, sizeZ, blockSize, heights } = chunk;

  // Create instances array for the block factory
  const instances: Array<{ position: THREE.Vector3; matrix: THREE.Matrix4 }> = [];
  
  for (let z = 0; z < sizeZ; z++) {
    for (let x = 0; x < sizeX; x++) {
      let h = heights[indexOf(x, z, sizeX)] ?? 0;
      
      // Use authoritative surface height if provided (accounts for multiple dig events)
      if (getSurfaceHeightAtWorld && chunkWorldPos) {
        const wx = chunkWorldPos.x + x - Math.floor(sizeX / 2);
        const wz = chunkWorldPos.z + z - Math.floor(sizeZ / 2);
        h = getSurfaceHeightAtWorld(wx, wz);
        if (h <= 0) {
          continue;
        }
      } else if (isBlockRemoved && chunkWorldPos) {
        // Fallback: step down while removed
        const wx = chunkWorldPos.x + x - Math.floor(sizeX / 2);
        const wz = chunkWorldPos.z + z - Math.floor(sizeZ / 2);
        while (h > 0 && isBlockRemoved(wx, h, wz)) {
          h -= 1;
        }
        if (h <= 0 && isBlockRemoved(wx, h, wz)) {
          continue;
        }
      }
      
      const position = new THREE.Vector3(
        (x - Math.floor(sizeX / 2)) * blockSize,
        h * blockSize,
        (z - Math.floor(sizeZ / 2)) * blockSize
      );
      
      const matrix = new THREE.Matrix4();
      matrix.setPosition(position);
      
      instances.push({ position, matrix });
    }
  }

  // Use the block factory to create the instanced mesh
  const result = await blockFactory.createInstancedBlock(
    blockTypeId,
    instances,
    { showCollisionOutlines: render.showCollisionOutlines }
  );

  return result;
}

export async function buildSnowOverlayInstancedMesh(
  chunk: ChunkData,
  render: RenderConfig,
  blockFactory: BlockFactory,
  snowBlockTypeId: string,
  thresholdHeight: number,
  snowDepth: number,
  getSurfaceHeightAtWorld?: (wx: number, wz: number) => number,
  chunkWorldPos?: { x: number; z: number }
): Promise<BuildResult | null> {
  const { sizeX, sizeZ, blockSize, heights } = chunk;

  const instances: Array<{ position: THREE.Vector3; matrix: THREE.Matrix4 }> = [];
  for (let z = 0; z < sizeZ; z++) {
    for (let x = 0; x < sizeX; x++) {
      let h = heights[indexOf(x, z, sizeX)] ?? 0;
      if (getSurfaceHeightAtWorld && chunkWorldPos) {
        const wx = chunkWorldPos.x + x - Math.floor(sizeX / 2);
        const wz = chunkWorldPos.z + z - Math.floor(sizeZ / 2);
        h = getSurfaceHeightAtWorld(wx, wz);
      }
      if (h > thresholdHeight) {
        // Top snow layer position(s). We keep it simple: place a snow block at the top and (snowDepth-1) blocks below if desired
        for (let d = 0; d < snowDepth; d++) {
          const y = h - d;
          if (y <= 0) break;
          const position = new THREE.Vector3(
            (x - Math.floor(sizeX / 2)) * blockSize,
            y * blockSize,
            (z - Math.floor(sizeZ / 2)) * blockSize
          );
          const matrix = new THREE.Matrix4();
          matrix.setPosition(position);
          instances.push({ position, matrix });
        }
      }
    }
  }

  if (instances.length === 0) return null;
  return await blockFactory.createInstancedBlock(snowBlockTypeId, instances, { showCollisionOutlines: render.showCollisionOutlines });
}

export async function buildWaterOverlayInstancedMesh(
  chunk: ChunkData,
  render: RenderConfig,
  blockFactory: BlockFactory,
  seaLevel: number,
  getSurfaceHeightAtWorld?: (wx: number, wz: number) => number,
  chunkWorldPos?: { x: number; z: number }
): Promise<BuildResult | null> {
  const { sizeX, sizeZ, blockSize, heights } = chunk;

  const instances: Array<{ position: THREE.Vector3; matrix: THREE.Matrix4 }> = [];
  for (let z = 0; z < sizeZ; z++) {
    for (let x = 0; x < sizeX; x++) {
      let h = heights[indexOf(x, z, sizeX)] ?? 0;
      if (getSurfaceHeightAtWorld && chunkWorldPos) {
        const wx = chunkWorldPos.x + x - Math.floor(sizeX / 2);
        const wz = chunkWorldPos.z + z - Math.floor(sizeZ / 2);
        h = getSurfaceHeightAtWorld(wx, wz);
      }
      // If terrain height is below sea level, fill vertical water column from just above ground up to sea level
      if (h < seaLevel) {
        const startY = Math.max(1, h + 1);
        for (let y = startY; y <= seaLevel; y++) {
          const position = new THREE.Vector3(
            (x - Math.floor(sizeX / 2)) * blockSize,
            y * blockSize,
            (z - Math.floor(sizeZ / 2)) * blockSize
          );
          const matrix = new THREE.Matrix4();
          matrix.setPosition(position);
          instances.push({ position, matrix });
        }
      }
    }
  }

  if (instances.length === 0) return null;
  return await blockFactory.createInstancedBlock('water', instances, { showCollisionOutlines: render.showCollisionOutlines });
}

export async function buildVoxelInstancedMeshes(
  chunk: ChunkData3D,
  render: RenderConfig,
  blockFactory: BlockFactory,
  isBlockRemoved?: (wx: number, wy: number, wz: number) => boolean,
  chunkWorldPos?: { x: number; z: number }
): Promise<{ meshes: Map<string, THREE.InstancedMesh>; outline?: THREE.LineSegments }> {
  const { sizeX, sizeY, sizeZ, blockSize, voxels } = chunk;
  const halfX = Math.floor(sizeX / 2);
  const halfZ = Math.floor(sizeZ / 2);

  const instancesByType = new Map<string, Array<{ position: THREE.Vector3; matrix: THREE.Matrix4 }>>();

  const getKind = (lx: number, ly: number, lz: number): VoxelKind => {
    if (lx < 0 || ly < 0 || lz < 0 || lx >= sizeX || ly >= sizeY || lz >= sizeZ) return VoxelKind.Air;
    const wx = (chunkWorldPos ? chunkWorldPos.x : 0) + lx - halfX;
    const wz = (chunkWorldPos ? chunkWorldPos.z : 0) + lz - halfZ;
    if (isBlockRemoved && isBlockRemoved(wx, ly, wz)) return VoxelKind.Air;
    return voxels[voxelIndex(lx, ly, lz, sizeX, sizeY)] as VoxelKind;
  };

  const isSolid = (k: VoxelKind) => (k === VoxelKind.Grass || k === VoxelKind.Dirt || k === VoxelKind.Stone || k === VoxelKind.Sand || k === VoxelKind.Snow);

  for (let z = 0; z < sizeZ; z++) {
    for (let y = 0; y < sizeY; y++) {
      for (let x = 0; x < sizeX; x++) {
        const kind = getKind(x, y, z);
        if (kind === VoxelKind.Air) continue;

        const kxp = getKind(x + 1, y, z);
        const kxm = getKind(x - 1, y, z);
        const kyp = getKind(x, y + 1, z);
        const kym = getKind(x, y - 1, z);
        const kzp = getKind(x, y, z + 1);
        const kzm = getKind(x, y, z - 1);

        let visible = false;
        if (kind === VoxelKind.Water) {
          // Water visible if adjacent to air or solid
          visible = (kxp === VoxelKind.Air || kxm === VoxelKind.Air || kyp === VoxelKind.Air || kym === VoxelKind.Air || kzp === VoxelKind.Air || kzm === VoxelKind.Air)
            || isSolid(kxp) || isSolid(kxm) || isSolid(kyp) || isSolid(kym) || isSolid(kzp) || isSolid(kzm);
        } else {
          // Solid visible if adjacent to air or water
          visible = (kxp === VoxelKind.Air || kxm === VoxelKind.Air || kyp === VoxelKind.Air || kym === VoxelKind.Air || kzp === VoxelKind.Air || kzm === VoxelKind.Air)
            || (kxp === VoxelKind.Water || kxm === VoxelKind.Water || kyp === VoxelKind.Water || kym === VoxelKind.Water || kzp === VoxelKind.Water || kzm === VoxelKind.Water);
        }
        if (!visible) continue;

        const blockTypeId = voxelToBlockId(kind);
        if (blockTypeId === 'air') continue;
        const arr = instancesByType.get(blockTypeId) ?? [];
        const position = new THREE.Vector3((x - halfX) * blockSize, y * blockSize, (z - halfZ) * blockSize);
        const matrix = new THREE.Matrix4();
        matrix.setPosition(position);
        arr.push({ position, matrix });
        instancesByType.set(blockTypeId, arr);
      }
    }
  }

  const meshes = new Map<string, THREE.InstancedMesh>();
  for (const [typeId, arr] of instancesByType) {
    const built = await blockFactory.createInstancedBlock(typeId, arr, { showCollisionOutlines: render.showCollisionOutlines });
    meshes.set(typeId, built.mesh);
  }
  return { meshes };
}
