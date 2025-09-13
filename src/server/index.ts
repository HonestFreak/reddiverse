import express from 'express';
import { InitResponse, IncrementResponse, DecrementResponse, PlayerPosition, GameRealtimeMessage, VoxelBlock, AddBlockRequest, RemoveBlockRequest, BlocksResponse } from '../shared/types/api';
import type { WorldConfig, TerrainType } from '../shared/types/WorldConfig';
import { redis, reddit, createServer, context, getServerPort, realtime } from '@devvit/web/server';
import { createPost } from './core/post';
import { mountPresenceRoutes } from './routes/presence';
import { mountBlocksRoutes } from './routes/blocks';

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

// Menu: Start world creation (shows form)
router.post('/internal/menu/start-world-create', async (_req, res): Promise<void> => {
  try {
    res.json({
      showForm: {
        name: 'worldConfigCreateForm',
        form: {
          title: 'Create Voxel World',
          description: 'Choose a terrain preset and optional seed. Immutable after creation.',
          fields: [
            {
              type: 'select',
              name: 'terrainType',
              label: 'Terrain preset',
              options: [
                { label: 'Greenery', value: 'greenery' },
                { label: 'Desert', value: 'desert' },
                { label: 'Mountains', value: 'mountains' },
              ],
              required: true,
              defaultValue: ['greenery'],
            },
            {
              type: 'string',
              name: 'seed',
              label: 'Seed (optional)',
              helpText: 'Leave blank for a random seed. Numbers or strings accepted.',
            },
          ],
          acceptLabel: 'Create',
          cancelLabel: 'Cancel',
        },
      },
    });
  } catch (e) {
    console.error('Failed to start world creation form', e);
    res.status(500).json({ status: 'error', message: 'Failed to show form' });
  }
});

function worldConfigKey(postId: string): string {
  return `worldConfig:${postId}`;
}

function hashToInt32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Convert to signed 32-bit then to unsigned range [0, 2^31-1]
  const signed = h | 0;
  return Math.abs(signed) % 2147483647;
}

// Form submit: persist world config once
router.post('/internal/form/world-config-create', async (req, res): Promise<void> => {
  try {
    const { postId } = context;
    const terrainType = ((req.body as any)?.terrainType?.[0] ?? 'greenery') as TerrainType;
    const seedRaw = String(((req.body as any)?.seed ?? '')).trim();
    const numericSeed = seedRaw
      ? Number.isFinite(Number(seedRaw))
        ? Math.floor(Number(seedRaw))
        : hashToInt32(seedRaw)
      : Math.floor(Math.random() * 2147483647);

    const config: WorldConfig = { terrainType, seed: numericSeed };

    // If invoked from a post menu, we have postId → save for that post
    if (postId) {
      const existing = await redis.get(worldConfigKey(postId));
      if (existing) {
        res.json({ showToast: 'World already initialized for this post' });
        return;
      }
      await redis.set(worldConfigKey(postId), JSON.stringify(config));
      res.json({ showToast: `World created: ${terrainType} (${numericSeed})` });
      return;
    }

    // If invoked from subreddit menu (no postId), create a post first
    const post = await createPost(config);
    await redis.set(worldConfigKey(post.id), JSON.stringify(config));
    res.json({
      showToast: `World created: ${terrainType} (${numericSeed})`,
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (e) {
    console.error('Failed to submit world config', e);
    res.json({ showToast: 'Failed to create world' });
  }
});

// Client API: get world config
router.get('/api/world-config', async (_req, res): Promise<void> => {
  const { postId } = context;
  if (!postId) {
    res.status(400).json({ status: 'error', message: 'postId is required' });
    return;
  }
  try {
    const raw = await redis.get(worldConfigKey(postId));
    if (!raw) {
      res.status(404).json({ status: 'error', message: 'world config not found' });
      return;
    }
    const cfg = JSON.parse(raw) as WorldConfig;
    res.json(cfg);
  } catch (e) {
    console.error('Failed to read world config', e);
    res.status(500).json({ status: 'error', message: 'Failed to read world config' });
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

// Mount modular routes
mountPresenceRoutes(router);
mountBlocksRoutes(router);
