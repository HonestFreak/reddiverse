import type { Router } from 'express';
import { context, redis, reddit, realtime } from '@devvit/web/server';
import type { GameRealtimeMessage, PlayerPosition } from '../../shared/types/api';

type PresenceMap = Record<string, PlayerPosition>;

function presenceKey(postId: string): string {
  return `presence:${postId}`;
}

async function readPresence(postId: string): Promise<PresenceMap> {
  try {
    const raw = await redis.get(presenceKey(postId));
    if (!raw) return {};
    return JSON.parse(raw) as PresenceMap;
  } catch (e) {
    console.error('Failed to read presence from redis', e);
    return {};
  }
}

async function writePresence(postId: string, presence: PresenceMap): Promise<void> {
  try {
    await redis.set(presenceKey(postId), JSON.stringify(presence));
  } catch (e) {
    console.error('Failed to write presence to redis', e);
  }
}

function channelForPost(postId: string): string {
  return `game:${postId}`;
}

export function mountPresenceRoutes(router: Router): void {
  router.get('/api/presence', async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({ status: 'error', message: 'postId is required' });
      return;
    }
    const presence = await readPresence(postId);
    const players = Object.entries(presence).map(([user, position]) => ({ user, position }));
    res.json({ players });
  });

  router.post('/api/join', async (req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({ status: 'error', message: 'postId is required' });
      return;
    }
    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    const position = req.body?.position as PlayerPosition | undefined;
    if (!position) {
      res.status(400).json({ status: 'error', message: 'position is required' });
      return;
    }
    const presence = await readPresence(postId);
    presence[username] = position;
    await writePresence(postId, presence);
    const msg: GameRealtimeMessage = { type: 'join', user: username, position };
    try {
      await realtime.send(channelForPost(postId), msg as any);
    } catch (e) {
      console.warn('realtime send(join) failed', e);
    }
    res.json({ status: 'ok' });
  });

  router.post('/api/pos', async (req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({ status: 'error', message: 'postId is required' });
      return;
    }
    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    const position = req.body?.position as PlayerPosition | undefined;
    if (!position) {
      res.status(400).json({ status: 'error', message: 'position is required' });
      return;
    }
    const presence = await readPresence(postId);
    presence[username] = position;
    await writePresence(postId, presence);
    const msg: GameRealtimeMessage = { type: 'pos', user: username, position };
    try {
      await realtime.send(channelForPost(postId), msg as any);
    } catch (e) {
      console.warn('realtime send(pos) failed', e);
    }
    res.json({ status: 'ok' });
  });

  router.post('/api/leave', async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({ status: 'error', message: 'postId is required' });
      return;
    }
    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    const presence = await readPresence(postId);
    if (presence[username]) {
      delete presence[username];
      await writePresence(postId, presence);
    }
    const msg: GameRealtimeMessage = { type: 'leave', user: username };
    try {
      await realtime.send(channelForPost(postId), msg as any);
    } catch (e) {
      console.warn('realtime send(leave) failed', e);
    }
    res.json({ status: 'ok' });
  });
}


