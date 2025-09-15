export type ChunkKey = string; // `${cx},${cz}`

export type ChunkIndex = {
  cx: number;
  cz: number;
};

export type ChunkData = {
  sizeX: number;
  sizeZ: number;
  blockSize: number;
  // Height values per (x,z), zero-based indices
  heights: Uint16Array | Uint8Array; // length sizeX*sizeZ
};

// 3D voxel enums stored in chunks for generation/rendering
export const enum VoxelKind {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Sand = 4,
  Water = 5,
  Snow = 6,
}

export type ChunkData3D = {
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  blockSize: number;
  voxels: Uint8Array; // length sizeX*sizeY*sizeZ of VoxelKind
  heights: Uint16Array; // topmost solid (non-air, non-water) per column length sizeX*sizeZ
};

export function chunkKey(cx: number, cz: number): ChunkKey {
  return `${cx},${cz}`;
}

export function indexOf(x: number, z: number, sizeX: number): number {
  return z * sizeX + x;
}

export function voxelIndex(x: number, y: number, z: number, sizeX: number, sizeY: number): number {
  return z * sizeX * sizeY + y * sizeX + x;
}

export function voxelToBlockId(kind: VoxelKind): string {
  switch (kind) {
    case VoxelKind.Grass: return 'grass';
    case VoxelKind.Dirt: return 'dirt';
    case VoxelKind.Stone: return 'stone';
    case VoxelKind.Sand: return 'sand';
    case VoxelKind.Water: return 'water';
    case VoxelKind.Snow: return 'snow';
    case VoxelKind.Air:
    default: return 'air';
  }
}


