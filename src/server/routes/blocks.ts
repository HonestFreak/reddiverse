import type { Router } from 'express';
import { context, redis, reddit } from '@devvit/web/server';
import type { AddBlockRequest, BlocksResponse, VoxelBlock } from '../../shared/types/api';
import { canUserBuild } from '../services/worldService';

function keyFor(x: number, y: number, z: number): string {
  return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

function getBlocksKey(postId: string): string {
  return `blocks:${postId}`;
}

// world config checks moved to worldService

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
    // Increment version counter for delta updates using incrBy
    await redis.incrBy(`${getBlocksKey(postId)}:version`, 1);
  } catch (e) {
    console.error('Failed to save blocks to Redis', e);
    throw e;
  }
}

async function getBlockChangesSince(postId: string, sinceVersion: number): Promise<Array<{type: 'add' | 'remove', x: number, y: number, z: number, blockType?: string, color?: string}>> {
  try {
    const currentVersion = parseInt(await redis.get(`${getBlocksKey(postId)}:version`) || '0');
    if (sinceVersion >= currentVersion) {
      return [];
    }
    
    // For now, return all blocks as changes (can be optimized later with proper change tracking)
    const blocks = await getBlocksFromRedis(postId);
    return blocks.map(block => {
      const result: { type: 'add' | 'remove'; x: number; y: number; z: number; blockType?: string; color?: string } = {
        type: 'add' as const,
        x: block.x,
        y: block.y,
        z: block.z
      };
      if (block.type) result.blockType = block.type;
      if (block.color) result.color = block.color;
      return result;
    });
  } catch (e) {
    console.error('Failed to get block changes', e);
    return [];
  }
}

export function mountBlocksRoutes(router: Router): void {
  router.get('/api/blocks', async (req, res): Promise<void> => {
    // Try to get postId from query parameter first, fallback to context
    const postId = req.query.postId as string || context.postId;
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

  router.get('/api/blocks/changes', async (req, res): Promise<void> => {
    // Try to get postId from query parameter first, fallback to context
    const postId = req.query.postId as string || context.postId;
    if (!postId) {
      res.status(400).json({ status: 'error', message: 'postId is required' });
      return;
    }
    
    const sinceVersion = parseInt(req.query.sinceVersion as string) || 0;
    
    try {
      const currentVersion = parseInt(await redis.get(`${getBlocksKey(postId)}:version`) || '0');
      
      if (sinceVersion >= currentVersion) {
        res.status(304).end(); // No changes
        return;
      }
      
      const changes = await getBlockChangesSince(postId, sinceVersion);
      res.json({ 
        version: currentVersion, 
        changes 
      });
    } catch (e) {
      console.error('Failed to get block changes', e);
      res.status(500).json({ status: 'error', message: 'Failed to get block changes' });
    }
  });

  router.post('/api/blocks/add', async (req, res): Promise<void> => {
    // Try to get postId from request body first, fallback to context
    const postId = (req.body as any)?.postId || context.postId;
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
    // Try to get postId from request body first, fallback to context
    const postId = (req.body as any)?.postId || context.postId;
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


