import type { Router } from 'express';
import { context, reddit } from '@devvit/web/server';
import type { WorldConfig, TerrainType } from '../../shared/types/WorldConfig';
import { createPost } from '../core/post';
import { canUserBuild, getWorldConfig, hashToInt32, setWorldConfig, updateBuilders, worldConfigKey } from '../services/worldService';
import { redis } from '@devvit/web/server';

export function mountWorldRoutes(router: Router): void {
  // Menu: Start world creation (shows form)
  router.post('/internal/menu/start-world-create', async (_req, res): Promise<void> => {
    try {
      res.json({
        showForm: {
          name: 'worldConfigCreateForm',
          form: {
            title: 'Generate a new Reddiverse',
            description: 'Configure your world settings. World name will be the post title.',
            fields: [
              { type: 'string', name: 'postTitle', label: 'Post Title', helpText: 'This will be displayed as the post title', required: true },
              { type: 'string', name: 'worldName', label: 'World Name', helpText: 'This will be displayed as the app name in the splash screen', required: true },
              { type: 'select', name: 'terrainType', label: 'Terrain preset', options: [
                { label: 'Greenery', value: 'greenery' },
                { label: 'Desert', value: 'desert' },
                { label: 'Mountains', value: 'mountains' },
              ], required: true, defaultValue: ['greenery'] },
              { type: 'string', name: 'seed', label: 'Seed (optional)', helpText: 'Leave blank for a random seed. Numbers or strings accepted.' },
              { type: 'select', name: 'buildingPermission', label: 'Building Permission', options: [
                { label: 'Public - Anyone can build', value: 'public' },
                { label: 'Restricted - Only owner and builders can build', value: 'restricted' },
              ], required: true, defaultValue: ['public'] },
              { type: 'string', name: 'builders', label: 'Builders (comma-separated usernames)', helpText: 'Only used when building permission is set to restricted. Leave empty to only allow the owner to build.' },
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

      if (!postTitle) { res.json({ showToast: 'Post title is required' }); return; }
      if (!worldName) { res.json({ showToast: 'World name is required' }); return; }

      const numericSeed = seedRaw
        ? Number.isFinite(Number(seedRaw))
          ? Math.floor(Number(seedRaw))
          : hashToInt32(seedRaw)
        : Math.floor(Math.random() * 2147483647);

      const builders = buildersRaw ? buildersRaw.split(',').map((b) => b.trim()).filter((b) => b.length > 0) : [];

      const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
      const config: WorldConfig = { terrainType, seed: numericSeed, worldName, buildingPermission, builders, owner: username };

      if (postId) {
        const existing = await redis.get(worldConfigKey(postId));
        if (existing) { res.json({ showToast: 'World already initialized for this post' }); return; }
        await setWorldConfig(postId, config);
        res.json({ showToast: `World created: ${worldName} (${terrainType})` });
        return;
      }

      const post = await createPost(config, postTitle, worldName);
      await setWorldConfig(post.id, config);
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
    if (!postId) { res.status(400).json({ status: 'error', message: 'postId is required' }); return; }
    try {
      const cfg = await getWorldConfig(postId);
      if (!cfg) { res.status(404).json({ status: 'error', message: 'world config not found' }); return; }
      res.json(cfg);
    } catch (e) {
      console.error('Failed to read world config', e);
      res.status(500).json({ status: 'error', message: 'Failed to read world config' });
    }
  });

  // Check if user can build in this world
  router.get('/api/can-build', async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) { res.status(400).json({ status: 'error', message: 'postId is required' }); return; }
    try {
      const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
      const cfg = await getWorldConfig(postId);
      if (!cfg) { res.json({ canBuild: true }); return; }
      const canBuild = await canUserBuild(postId, username);
      res.json({ canBuild, isOwner: cfg.owner === username });
    } catch (e) {
      console.error('Failed to check build permission', e);
      res.status(500).json({ status: 'error', message: 'Failed to check build permission' });
    }
  });

  // Update builders list (owner only)
  router.post('/api/update-builders', async (req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) { res.status(400).json({ status: 'error', message: 'postId is required' }); return; }
    try {
      const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
      const { builders } = (req.body ?? {}) as { builders: string[] };
      if (!Array.isArray(builders)) { res.status(400).json({ status: 'error', message: 'builders must be an array' }); return; }
      const updated = await updateBuilders(postId, builders, username);
      res.json({ status: 'ok', builders: updated.builders });
    } catch (e: any) {
      if (e?.code === 'FORBIDDEN') {
        res.status(403).json({ status: 'error', message: e.message });
      } else if ((e as Error)?.message === 'world config not found') {
        res.status(404).json({ status: 'error', message: 'world config not found' });
      } else {
        console.error('Failed to update builders', e);
        res.status(500).json({ status: 'error', message: 'Failed to update builders' });
      }
    }
  });
}


