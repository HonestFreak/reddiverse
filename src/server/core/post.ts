import { context, reddit } from '@devvit/web/server';
import type { WorldConfig } from '../../shared/types/WorldConfig';

export const createPost = async (worldConfig?: WorldConfig, worldName?: string) => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  return await reddit.submitCustomPost({
    splash: {
      appDisplayName: 'myvoxel234',
    },
    subredditName: subredditName,
    title: worldName || 'myvoxel234',
    // Store initial world config in post data for traceability (primary store is Redis)
    postData: worldConfig ? { worldConfig } : {},
  });
};
