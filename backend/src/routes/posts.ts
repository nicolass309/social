import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import prisma from '../lib/db';

const router = Router();

const createPostSchema = z.object({
  title: z.string().max(100),
  description: z.string().max(2200),
  videoUrl: z.string().url(),
  videoKey: z.string(),
  platforms: z.array(z.enum(['youtube', 'instagram', 'tiktok'])).min(1),
  scheduledAt: z.string().datetime().optional(),
  hashtags: z.string().optional(),
});

router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const posts = await prisma.post.findMany({
      include: { results: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    return res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id as string },
      include: { results: true },
    });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    return res.json(post);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch post' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createPostSchema.parse(req.body);
    const description = data.hashtags
      ? `${data.description}\n\n${data.hashtags.split(',').map(t => `#${t.trim()}`).join(' ')}`
      : data.description;

    const post = await prisma.post.create({
      data: {
        title: data.title,
        description,
        videoUrl: data.videoUrl,
        videoKey: data.videoKey,
        platforms: data.platforms,
        status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      },
    });

    return res.status(201).json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    console.error('Error creating post:', error);
    return res.status(500).json({ error: 'Failed to create post' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id as string } });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    // If has video in R2, delete it
    if (post.videoKey) {
      const { deleteVideo } = await import('../lib/storage');
      await deleteVideo(post.videoKey);
    }

    await prisma.postResult.deleteMany({ where: { postId: req.params.id as string } });
    await prisma.post.delete({ where: { id: req.params.id as string } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete post' });
  }
});

export default router;
