import type { Router } from 'express';
import { context, redis, reddit } from '@devvit/web/server';
import type { AddBlockRequest, BlocksResponse, VoxelBlock } from '../../shared/types/api';
import type { WorldConfig } from '../../shared/types/WorldConfig';

function keyFor(x: number, y: number, z: number): string {
  return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

function getBlocksKey(postId: string): string {
  return `blocks:${postId}`;
}

function worldConfigKey(postId: string): string {
  return `worldConfig:${postId}`;
}

async function getWorldConfig(postId: string): Promise<WorldConfig | null> {
  try {
    const raw = await redis.get(worldConfigKey(postId));
    if (!raw) return null;
    return JSON.parse(raw) as WorldConfig;
  } catch (e) {
    console.error('Failed to get world config', e);
    return null;
  }
}

async function canUserBuild(postId: string, username: string): Promise<boolean> {
  const worldConfig = await getWorldConfig(postId);
  if (!worldConfig) {
    // If no world config, allow building (backward compatibility)
    return true;
  }
  
  // If building permission is public, anyone can build
  if (worldConfig.buildingPermission === 'public') {
    return true;
  }
  
  // If restricted, only owner and builders can build
  if (worldConfig.buildingPermission === 'restricted') {
    return worldConfig.owner === username || worldConfig.builders.includes(username);
  }
  
  return false;
}

async function getBlocksFromRedis(postId: string): Promise<VoxelBlock[]> {
  try {
    const blocksData = await redis.get(getBlocksKey(postId));
    if (!blocksData) {
      // Try to migrate from old post data format
      return await migrateFromPostData(postId);
    }
    
    const blocks = JSON.parse(blocksData) as VoxelBlock[];
    return blocks
      .filter((b) => typeof b === 'object' && b !== null)
      .map((b) => ({ x: Number(b.x), y: Number(b.y), z: Number(b.z), type: b.type, color: b.color }))
      .filter((b) => Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.z));
  } catch (e) {
    console.error('Failed to get blocks from Redis', e);
    return [];
  }
}

async function migrateFromPostData(postId: string): Promise<VoxelBlock[]> {
  try {
    // Check if there's old data in post data format
    const pd = (context as any).postData as { blocks?: VoxelBlock[] } | undefined;
    const blocks = Array.isArray(pd?.blocks) ? pd!.blocks! : [];
    
    if (blocks.length > 0) {
      console.log(`Migrating ${blocks.length} blocks from post data to Redis for post ${postId}`);
      const validBlocks = blocks
        .filter((b) => typeof b === 'object' && b !== null)
        .map((b) => ({ x: Number((b as any).x), y: Number((b as any).y), z: Number((b as any).z), type: (b as any).type, color: (b as any).color }))
        .filter((b) => Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.z));
      
      // Save to Redis
      await saveBlocksToRedis(postId, validBlocks);
      return validBlocks;
    }
    
    return [];
  } catch (e) {
    console.error('Failed to migrate from post data', e);
    return [];
  }
}

async function saveBlocksToRedis(postId: string, blocks: VoxelBlock[]): Promise<void> {
  try {
    await redis.set(getBlocksKey(postId), JSON.stringify(blocks));
  } catch (e) {
    console.error('Failed to save blocks to Redis', e);
    throw e;
  }
}

export function mountBlocksRoutes(router: Router): void {
  router.get('/api/blocks', async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({ status: 'error', message: 'postId is required' });
      return;
    }
    try {
      const blocks = await getBlocksFromRedis(postId);
      const payload: BlocksResponse = { blocks };
      res.json(payload);
    } catch (e) {
      console.error('Failed reading blocks from Redis', e);
      res.status(500).json({ status: 'error', message: 'Failed to read blocks' });
    }
  });

  router.post('/api/blocks/add', async (req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({ status: 'error', message: 'postId is required' });
      return;
    }
    const body = req.body as AddBlockRequest | undefined;
    if (!body || !Number.isFinite(body.x) || !Number.isFinite(body.y) || !Number.isFinite(body.z)) {
      res.status(400).json({ status: 'error', message: 'x,y,z are required' });
      return;
    }
    
    // Check building permissions
    const username = await reddit.getCurrentUsername() ?? 'anonymous';
    const canBuild = await canUserBuild(postId, username);
    if (!canBuild) {
      res.status(403).json({ status: 'error', message: 'You do not have permission to build in this world' });
      return;
    }
    
    try {
      const existingBlocks = await getBlocksFromRedis(postId);
      const map = new Map<string, VoxelBlock>();
      for (const b of existingBlocks) map.set(keyFor(b.x, b.y, b.z), b);
      map.set(keyFor(body.x, body.y, body.z), { 
        x: Math.floor(body.x), 
        y: Math.floor(body.y), 
        z: Math.floor(body.z), 
        type: body.type, 
        color: body.color 
      });
      await saveBlocksToRedis(postId, Array.from(map.values()));
      res.json({ status: 'ok' });
    } catch (e) {
      console.error('Failed to add block', e);
      res.status(500).json({ status: 'error', message: 'Failed to add block' });
    }
  });

  router.post('/api/blocks/remove', async (req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({ status: 'error', message: 'postId is required' });
      return;
    }
    const body = req.body as { x: number; y: number; z: number } | undefined;
    if (!body || !Number.isFinite(body.x) || !Number.isFinite(body.y) || !Number.isFinite(body.z)) {
      res.status(400).json({ status: 'error', message: 'x,y,z are required' });
      return;
    }
    
    // Check building permissions
    const username = await reddit.getCurrentUsername() ?? 'anonymous';
    const canBuild = await canUserBuild(postId, username);
    if (!canBuild) {
      res.status(403).json({ status: 'error', message: 'You do not have permission to build in this world' });
      return;
    }
    
    try {
      const existingBlocks = await getBlocksFromRedis(postId);
      const map = new Map<string, VoxelBlock>();
      for (const b of existingBlocks) map.set(keyFor(b.x, b.y, b.z), b);
      map.delete(keyFor(body.x, body.y, body.z));
      await saveBlocksToRedis(postId, Array.from(map.values()));
      res.json({ status: 'ok' });
    } catch (e) {
      console.error('Failed to remove block', e);
      res.status(500).json({ status: 'error', message: 'Failed to remove block' });
    }
  });
}


