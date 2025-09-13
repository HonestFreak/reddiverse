import type { Router } from 'express';
import { context, redis, reddit } from '@devvit/web/server';
import type { PlayerState } from '../../shared/types/SmartBlocks';

function playerStateKey(postId: string): string {
  return `playerState:${postId}`;
}

async function readAll(postId: string): Promise<Record<string, PlayerState>> {
  try {
    const raw = await redis.get(playerStateKey(postId));
    if (!raw) return {};
    const v = JSON.parse(raw) as Record<string, PlayerState>;
    return v && typeof v === 'object' ? v : {};
  } catch (e) {
    console.error('readAll player state failed', e);
    return {};
  }
}

async function writeAll(postId: string, data: Record<string, PlayerState>): Promise<void> {
  try {
    await redis.set(playerStateKey(postId), JSON.stringify(data));
  } catch (e) {
    console.error('writeAll player state failed', e);
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function mountPlayerStateRoutes(router: Router): void {
  router.get('/api/player-state', async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({ status: 'error', message: 'postId is required' });
      return;
    }
    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    const all = await readAll(postId);
    const state: PlayerState = all[username] ?? { life: 100, isWinner: false, badge: '' };
    res.json(state);
  });

  router.post('/api/player-state', async (req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({ status: 'error', message: 'postId is required' });
      return;
    }
    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    const body = (req.body ?? {}) as Partial<PlayerState>;
    const all = await readAll(postId);
    const current = all[username] ?? { life: 100, isWinner: false, badge: '' };
    const next: PlayerState = {
      life: clamp(Number.isFinite(body.life as number) ? (body.life as number) : current.life, 0, 100),
      isWinner: typeof body.isWinner === 'boolean' ? body.isWinner : current.isWinner,
      badge: typeof body.badge === 'string' ? body.badge : current.badge,
    };
    all[username] = next;
    await writeAll(postId, all);
    res.json(next);
  });
}


