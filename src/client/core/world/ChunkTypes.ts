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
  heights: Uint8Array; // length sizeX*sizeZ
};

export function chunkKey(cx: number, cz: number): ChunkKey {
  return `${cx},${cz}`;
}

export function indexOf(x: number, z: number, sizeX: number): number {
  return z * sizeX + x;
}


