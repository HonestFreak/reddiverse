import { context, reddit } from '@devvit/web/server';

export const createPost = async () => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  return await reddit.submitCustomPost({
    splash: {
      appDisplayName: 'myvoxel234',
    },
    subredditName: subredditName,
    title: 'myvoxel234',
    // No need to store blocks in post data anymore - using Redis instead
    postData: {},
  });
};
