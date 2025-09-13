import * as THREE from 'three';
import { ChunkData, indexOf } from './ChunkTypes';
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
  chunkWorldPos?: { x: number; z: number }
): Promise<BuildResult> {
  const { sizeX, sizeZ, blockSize, heights } = chunk;

  // Create instances array for the block factory
  const instances: Array<{ position: THREE.Vector3; matrix: THREE.Matrix4 }> = [];
  
  for (let z = 0; z < sizeZ; z++) {
    for (let x = 0; x < sizeX; x++) {
      const h = heights[indexOf(x, z, sizeX)] ?? 0;
      
      // Calculate world position if chunk world position is provided
      if (isBlockRemoved && chunkWorldPos) {
        const wx = chunkWorldPos.x + x - Math.floor(sizeX / 2);
        const wy = h;
        const wz = chunkWorldPos.z + z - Math.floor(sizeZ / 2);
        
        // Skip this block if it's been removed
        if (isBlockRemoved(wx, wy, wz)) {
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
