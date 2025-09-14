import { context, reddit } from '@devvit/web/server';
import type { WorldConfig } from '../../shared/types/WorldConfig';

export const createPost = async (worldConfig?: WorldConfig, postTitle?: string, worldName?: string) => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  // Get current user info for splash screen
  const username = await reddit.getCurrentUsername() ?? 'anonymous';
  const user = await reddit.getCurrentUser();
  const snooavatarUrl = user ? await user.getSnoovatarUrl() : undefined;

  // Determine background image based on terrain type
  const getBackgroundUri = (terrainType?: string) => {
    switch (terrainType) {
      case 'greenery':
        return 'greenery.png';
      case 'mountains':
        return 'mountains.png';
      case 'desert':
        return 'desert.png';
      default:
        return 'greenery.png';
    }
  };

  return await reddit.submitCustomPost({
    splash: {
      appDisplayName: worldName || 'myvoxel234',
      backgroundUri: getBackgroundUri(worldConfig?.terrainType),
      buttonLabel: 'Explore',
      description: `Made by ${username}`,
      heading: worldName || 'myvoxel234',
      appIconUri: snooavatarUrl || undefined,
    },
    subredditName: subredditName,
    title: postTitle || worldName || 'myvoxel234',
    // Store initial world config in post data for traceability (primary store is Redis)
    postData: worldConfig ? { worldConfig } : {},
  });
};
