import { VoxelBlock } from '../../shared/types/api';

export async function getBlocks(): Promise<VoxelBlock[]> {
  const res = await fetch('/api/blocks');
  if (!res.ok) throw new Error('Failed to load blocks');
  const data = (await res.json()) as { blocks?: VoxelBlock[] };
  return Array.isArray(data.blocks) ? data.blocks : [];
}

export async function addBlock(x: number, y: number, z: number, type?: string, color?: string): Promise<void> {
  await fetch('/api/blocks/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x, y, z, type, color }),
  });
}

export async function removeBlock(x: number, y: number, z: number): Promise<void> {
  await fetch('/api/blocks/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x, y, z }),
  });
}


