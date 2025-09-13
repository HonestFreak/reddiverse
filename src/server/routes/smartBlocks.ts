import type { Router } from 'express';
import { context, redis } from '@devvit/web/server';
import { media } from '@devvit/media';
import type { SmartBlockDefinition, SmartBlocksResponse, SmartAction } from '../../shared/types/SmartBlocks';

function smartBlocksKey(postId: string): string {
  return `smartBlocks:${postId}`;
}

async function readSmartBlocks(postId: string): Promise<SmartBlockDefinition[]> {
  try {
    const raw = await redis.get(smartBlocksKey(postId));
    if (!raw) return [];
    const list = JSON.parse(raw) as SmartBlockDefinition[];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('readSmartBlocks failed', e);
    return [];
  }
}

async function writeSmartBlocks(postId: string, defs: SmartBlockDefinition[]): Promise<void> {
  try {
    await redis.set(smartBlocksKey(postId), JSON.stringify(defs));
  } catch (e) {
    console.error('writeSmartBlocks failed', e);
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 40);
}

function inferMediaType(url: string): 'gif' | 'png' | 'jpeg' {
  const u = url.toLowerCase();
  if (u.endsWith('.gif')) return 'gif';
  if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'jpeg';
  return 'png';
}

function parseActions(jsonStr: unknown): SmartAction[] | undefined {
  if (typeof jsonStr !== 'string' || jsonStr.trim() === '') return undefined;
  try {
    const parsed = JSON.parse(jsonStr) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    // Very light validation for safety
    const allowed = new Set([
      'setLife',
      'setWinner',
      'setBadge',
      'impulse',
      'placeBlock',
      'removeBlock',
    ]);
    const actions: SmartAction[] = [];
    for (const a of parsed as any[]) {
      if (a && typeof a === 'object' && allowed.has(a.type)) {
        actions.push(a as SmartAction);
      }
    }
    return actions.length ? actions : undefined;
  } catch (e) {
    console.warn('Failed to parse actions JSON', e);
    return undefined;
  }
}

export function mountSmartBlocksRoutes(router: Router): void {
  // List smart blocks for client
  router.get('/api/smart-blocks', async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({ status: 'error', message: 'postId is required' });
      return;
    }
    const defs = await readSmartBlocks(postId);
    const payload: SmartBlocksResponse = { blocks: defs };
    res.json(payload);
  });

  // In-game creation endpoint for players
  router.post('/api/smart-blocks/create', async (req, res): Promise<void> => {
    try {
      const { postId } = context;
      if (!postId) {
        res.status(400).json({ status: 'error', message: 'postId is required' });
        return;
      }

      const body = req.body as {
        name?: string;
        textures?: {
          side?: { type: 'color' | 'image'; value: string };
          top?: { type: 'color' | 'image'; value: string };
          bottom?: { type: 'color' | 'image'; value: string };
        };
        onClick?: SmartAction[];
        onTouch?: SmartAction[];
      } | undefined;

      const name = String(body?.name ?? '').trim();
      if (!name) {
        res.status(400).json({ status: 'error', message: 'name is required' });
        return;
      }

      async function processFace(input: { type: 'color' | 'image'; value: string } | undefined) {
        if (!input) return undefined;
        if (input.type === 'color') {
          const color = String(input.value || '').trim();
          if (!color) return undefined;
          return { type: 'color' as const, value: color };
        }
        const url = String(input.value || '').trim();
        if (!url) return undefined;
        try {
          const uploaded = await media.upload({ url, type: inferMediaType(url) });
          return { type: 'image' as const, value: uploaded.url };
        } catch (e) {
          console.warn('media upload failed (create api)', e);
          return undefined;
        }
      }

      const side = await processFace(body?.textures?.side);
      const top = await processFace(body?.textures?.top);
      const bottom = await processFace(body?.textures?.bottom);

      const id = `${slugify(name)}-${Date.now().toString(36)}`;
      const def: SmartBlockDefinition = {
        id,
        name,
        textures: { ...(side ? { side } : {}), ...(top ? { top } : {}), ...(bottom ? { bottom } : {}) },
        ...(Array.isArray(body?.onClick) && body?.onClick.length ? { onClick: body?.onClick } : {}),
        ...(Array.isArray(body?.onTouch) && body?.onTouch.length ? { onTouch: body?.onTouch } : {}),
      };

      const existing = await readSmartBlocks(postId);
      existing.push(def);
      await writeSmartBlocks(postId, existing);
      res.json({ status: 'ok', block: def });
    } catch (e) {
      console.error('smart-blocks/create failed', e);
      res.status(500).json({ status: 'error', message: 'create failed' });
    }
  });

  // Removed menu/form creation: Smart Blocks are created in-game via /api/smart-blocks/create
}


