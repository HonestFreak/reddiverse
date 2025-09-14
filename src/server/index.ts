import express from 'express';
import { InitResponse, IncrementResponse, DecrementResponse } from '../shared/types/api';
import type { WorldConfig, TerrainType } from '../shared/types/WorldConfig';
import { redis, reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';
import { mountPresenceRoutes } from './routes/presence';
import { mountBlocksRoutes } from './routes/blocks';
import { mountSmartBlocksRoutes } from './routes/smartBlocks';
import { mountPlayerStateRoutes } from './routes/playerState';

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
          description: 'Configure your world settings. World name will be the post title.',
          fields: [
            {
              type: 'string',
              name: 'postTitle',
              label: 'Post Title',
              helpText: 'This will be displayed as the post title',
              required: true,
            },
            {
              type: 'string',
              name: 'worldName',
              label: 'World Name',
              helpText: 'This will be displayed as the app name in the splash screen',
              required: true,
            },
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
            {
              type: 'select',
              name: 'buildingPermission',
              label: 'Building Permission',
              options: [
                { label: 'Public - Anyone can build', value: 'public' },
                { label: 'Restricted - Only owner and builders can build', value: 'restricted' },
              ],
              required: true,
              defaultValue: ['public'],
            },
            {
              type: 'string',
              name: 'builders',
              label: 'Builders (comma-separated usernames)',
              helpText: 'Only used when building permission is set to restricted. Leave empty to only allow the owner to build.',
            },
          ],
          acceptLabel: 'Create World',
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
    const postTitle = String(((req.body as any)?.postTitle ?? '')).trim();
    const worldName = String(((req.body as any)?.worldName ?? '')).trim();
    const terrainType = ((req.body as any)?.terrainType?.[0] ?? 'greenery') as TerrainType;
    const seedRaw = String(((req.body as any)?.seed ?? '')).trim();
    const buildingPermission = ((req.body as any)?.buildingPermission?.[0] ?? 'public') as 'public' | 'restricted';
    const buildersRaw = String(((req.body as any)?.builders ?? '')).trim();
    
    if (!postTitle) {
      res.json({ showToast: 'Post title is required' });
      return;
    }
    
    if (!worldName) {
      res.json({ showToast: 'World name is required' });
      return;
    }
    
    const numericSeed = seedRaw
      ? Number.isFinite(Number(seedRaw))
        ? Math.floor(Number(seedRaw))
        : hashToInt32(seedRaw)
      : Math.floor(Math.random() * 2147483647);

    // Parse builders list
    const builders = buildersRaw
      ? buildersRaw.split(',').map(b => b.trim()).filter(b => b.length > 0)
      : [];

    const username = await reddit.getCurrentUsername() ?? 'anonymous';
    const config: WorldConfig = { 
      terrainType, 
      seed: numericSeed, 
      worldName,
      buildingPermission,
      builders,
      owner: username
    };

    // If invoked from a post menu, we have postId → save for that post
    if (postId) {
      const existing = await redis.get(worldConfigKey(postId));
      if (existing) {
        res.json({ showToast: 'World already initialized for this post' });
        return;
      }
      await redis.set(worldConfigKey(postId), JSON.stringify(config));
      res.json({ showToast: `World created: ${worldName} (${terrainType})` });
      return;
    }

    // If invoked from subreddit menu (no postId), create a post first
    const post = await createPost(config, postTitle, worldName);
    await redis.set(worldConfigKey(post.id), JSON.stringify(config));
    res.json({
      showToast: `World created: ${worldName} (${terrainType})`,
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

// Check if user can build in this world
router.get('/api/can-build', async (_req, res): Promise<void> => {
  const { postId } = context;
  if (!postId) {
    res.status(400).json({ status: 'error', message: 'postId is required' });
    return;
  }
  try {
    const username = await reddit.getCurrentUsername() ?? 'anonymous';
    const raw = await redis.get(worldConfigKey(postId));
    if (!raw) {
      res.json({ canBuild: true }); // Backward compatibility
      return;
    }
    const cfg = JSON.parse(raw) as WorldConfig;
    
    let canBuild = false;
    if (cfg.buildingPermission === 'public') {
      canBuild = true;
    } else if (cfg.buildingPermission === 'restricted') {
      canBuild = cfg.owner === username || cfg.builders.includes(username);
    }
    
    res.json({ canBuild, isOwner: cfg.owner === username });
  } catch (e) {
    console.error('Failed to check build permission', e);
    res.status(500).json({ status: 'error', message: 'Failed to check build permission' });
  }
});

// Update builders list (owner only)
router.post('/api/update-builders', async (req, res): Promise<void> => {
  const { postId } = context;
  if (!postId) {
    res.status(400).json({ status: 'error', message: 'postId is required' });
    return;
  }
  try {
    const username = await reddit.getCurrentUsername() ?? 'anonymous';
    const raw = await redis.get(worldConfigKey(postId));
    if (!raw) {
      res.status(404).json({ status: 'error', message: 'world config not found' });
      return;
    }
    const cfg = JSON.parse(raw) as WorldConfig;
    
    // Only owner can update builders
    if (cfg.owner !== username) {
      res.status(403).json({ status: 'error', message: 'Only the world owner can update builders' });
      return;
    }
    
    const { builders } = req.body as { builders: string[] };
    if (!Array.isArray(builders)) {
      res.status(400).json({ status: 'error', message: 'builders must be an array' });
      return;
    }
    
    // Update the config
    const updatedConfig: WorldConfig = {
      ...cfg,
      builders: builders.filter(b => typeof b === 'string' && b.trim().length > 0)
    };
    
    await redis.set(worldConfigKey(postId), JSON.stringify(updatedConfig));
    res.json({ status: 'ok', builders: updatedConfig.builders });
  } catch (e) {
    console.error('Failed to update builders', e);
    res.status(500).json({ status: 'error', message: 'Failed to update builders' });
  }
});

app.use(router);

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());

// Mount modular routes
mountPresenceRoutes(router);
mountBlocksRoutes(router);
mountSmartBlocksRoutes(router);
mountPlayerStateRoutes(router);
