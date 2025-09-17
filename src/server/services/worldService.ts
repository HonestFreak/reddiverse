import { redis } from '@devvit/web/server';
import type { WorldConfig } from '../../shared/types/WorldConfig';

export function worldConfigKey(postId: string): string {
  return `worldConfig:${postId}`;
}

export function hashToInt32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const signed = h | 0;
  return Math.abs(signed) % 2147483647;
}

export async function getWorldConfig(postId: string): Promise<WorldConfig | null> {
  try {
    const raw = await redis.get(worldConfigKey(postId));
    if (!raw) return null;
    return JSON.parse(raw) as WorldConfig;
  } catch (e) {
    console.error('Failed to get world config', e);
    return null;
  }
}

export async function setWorldConfig(postId: string, cfg: WorldConfig): Promise<void> {
  await redis.set(worldConfigKey(postId), JSON.stringify(cfg));
}

export async function canUserBuild(postId: string, username: string): Promise<boolean> {
  const cfg = await getWorldConfig(postId);
  if (!cfg) return true;
  if (cfg.buildingPermission === 'public') return true;
  if (cfg.buildingPermission === 'restricted') {
    return cfg.owner === username || cfg.builders.includes(username);
  }
  return false;
}

export async function updateBuilders(
  postId: string,
  builders: string[],
  actingUser: string
): Promise<WorldConfig> {
  const raw = await redis.get(worldConfigKey(postId));
  if (!raw) throw new Error('world config not found');
  const cfg = JSON.parse(raw) as WorldConfig;
  if (cfg.owner !== actingUser) {
    const err = new Error('Only the world owner can update builders');
    (err as any).code = 'FORBIDDEN';
    throw err;
  }
  const sanitized = builders.filter((b) => typeof b === 'string' && b.trim().length > 0);
  const next: WorldConfig = { ...cfg, builders: sanitized };
  await setWorldConfig(postId, next);
  return next;
}


