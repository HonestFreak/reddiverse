import express from 'express';
import { InitResponse, IncrementResponse, DecrementResponse, PlayerPosition, GameRealtimeMessage, VoxelBlock, AddBlockRequest, RemoveBlockRequest, BlocksResponse } from '../shared/types/api';
import { redis, reddit, createServer, context, getServerPort, realtime } from '@devvit/web/server';
import { createPost } from './core/post';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

router.get<{ postId: string }, InitResponse | { status: string; message: string }>(
  '/api/init',
  async (_req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      console.error('API Init Error: postId not found in devvit context');
      res.status(400).json({
        status: 'error',
        message: 'postId is required but missing from context',
      });
      return;
    }

    try {
      const [count, username] = await Promise.all([
        redis.get('count'),
        reddit.getCurrentUsername(),
      ]);

      res.json({
        type: 'init',
        postId: postId,
        count: count ? parseInt(count) : 0,
        username: username ?? 'anonymous',
      });
    } catch (error) {
      console.error(`API Init Error for post ${postId}:`, error);
      let errorMessage = 'Unknown error during initialization';
      if (error instanceof Error) {
        errorMessage = `Initialization failed: ${error.message}`;
      }
      res.status(400).json({ status: 'error', message: errorMessage });
    }
  }
);

router.post<{ postId: string }, IncrementResponse | { status: string; message: string }, unknown>(
  '/api/increment',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', 1),
      postId,
      type: 'increment',
    });
  }
);

router.post<{ postId: string }, DecrementResponse | { status: string; message: string }, unknown>(
  '/api/decrement',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', -1),
      postId,
      type: 'decrement',
    });
  }
);

router.post('/internal/on-app-install', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      status: 'success',
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

router.post('/internal/menu/post-create', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

app.use(router);

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());

// Multiplayer realtime endpoints
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

// Voxel blocks persistence via post data
function blocksFromPostData(): VoxelBlock[] {
  const pd = (context as any).postData as { blocks?: VoxelBlock[] } | undefined;
  const blocks = Array.isArray(pd?.blocks) ? pd!.blocks! : [];
  // Ensure minimal schema
  return blocks
    .filter((b) => typeof b === 'object' && b !== null)
    .map((b) => ({ x: Number((b as any).x), y: Number((b as any).y), z: Number((b as any).z), type: (b as any).type, color: (b as any).color }))
    .filter((b) => Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.z));
}

function keyFor(x: number, y: number, z: number): string {
  return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

router.get('/api/blocks', async (_req, res): Promise<void> => {
  const { postId } = context;
  if (!postId) {
    res.status(400).json({ status: 'error', message: 'postId is required' });
    return;
  }

  try {
    const blocks = blocksFromPostData();
    const payload: BlocksResponse = { blocks };
    res.json(payload);
  } catch (e) {
    console.error('Failed reading blocks from postData', e);
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

  try {
    const existingBlocks = blocksFromPostData();
    const map = new Map<string, VoxelBlock>();
    for (const b of existingBlocks) map.set(keyFor(b.x, b.y, b.z), b);
    map.set(keyFor(body.x, body.y, body.z), { x: Math.floor(body.x), y: Math.floor(body.y), z: Math.floor(body.z), type: body.type, color: body.color });

    const merged: { [key: string]: any } = { ...(context as any).postData, blocks: Array.from(map.values()) };
    const post = await reddit.getPostById(postId);
    await post.setPostData(merged as any);
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
  const body = req.body as RemoveBlockRequest | undefined;
  if (!body || !Number.isFinite(body.x) || !Number.isFinite(body.y) || !Number.isFinite(body.z)) {
    res.status(400).json({ status: 'error', message: 'x,y,z are required' });
    return;
  }

  try {
    const existingBlocks = blocksFromPostData();
    const map = new Map<string, VoxelBlock>();
    for (const b of existingBlocks) map.set(keyFor(b.x, b.y, b.z), b);
    map.delete(keyFor(body.x, body.y, body.z));

    const merged: { [key: string]: any } = { ...(context as any).postData, blocks: Array.from(map.values()) };
    const post = await reddit.getPostById(postId);
    await post.setPostData(merged as any);
    res.json({ status: 'ok' });
  } catch (e) {
    console.error('Failed to remove block', e);
    res.status(500).json({ status: 'error', message: 'Failed to remove block' });
  }
});
