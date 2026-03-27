import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../lib/db';

const router = Router();

router.get('/scheduled', async (_req: AuthRequest, res: Response) => {
  try {
    const posts = await prisma.post.findMany({
      where: { status: 'SCHEDULED' },
      include: { results: true },
      orderBy: { scheduledAt: 'asc' },
    });
    return res.json(posts);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch scheduled posts' });
  }
});

export default router;
