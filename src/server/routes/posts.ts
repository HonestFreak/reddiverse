import type { Router } from 'express';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';

export function mountPostRoutes(router: Router): void {
  router.post('/internal/on-app-install', async (_req, res): Promise<void> => {
    try {
      const post = await createPost();
      res.json({
        status: 'success',
        message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
      });
    } catch (error) {
      console.error(`Error creating post: ${error}`);
      res.status(400).json({ status: 'error', message: 'Failed to create post' });
    }
  });

  router.post('/internal/menu/post-create', async (_req, res): Promise<void> => {
    try {
      const post = await createPost();
      res.json({ navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}` });
    } catch (error) {
      console.error(`Error creating post: ${error}`);
      res.status(400).json({ status: 'error', message: 'Failed to create post' });
    }
  });
}


