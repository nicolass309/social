import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../lib/db';
import { publishToYouTube } from '../lib/platforms/youtube';
import { publishToInstagram } from '../lib/platforms/instagram';
import { publishToTikTok } from '../lib/platforms/tiktok';
import { deleteVideo } from '../lib/storage';

const router = Router();

interface PlatformPublisher {
  (post: { title: string; description: string; videoUrl: string }): Promise<{
    platformId?: string;
    platformUrl?: string;
  }>;
}

const publishers: Record<string, PlatformPublisher> = {
  youtube: publishToYouTube,
  instagram: publishToInstagram,
  tiktok: publishToTikTok,
};

router.post('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id as string },
      include: { results: true },
    });

    if (!post) return res.status(404).json({ error: 'Post not found' });
    const postWithResults = post as typeof post & { results: any[] };
    if (!post.videoUrl) return res.status(400).json({ error: 'No video attached. Please upload again.' });

    await prisma.post.update({
      where: { id: post.id },
      data: { status: 'PUBLISHING' },
    });

    // Create pending results
    for (const platform of post.platforms) {
      const existingResult = postWithResults.results.find((r: any) => r.platform === platform);
      if (!existingResult) {
        await prisma.postResult.create({
          data: {
            postId: post.id,
            platform: platform as string,
            status: 'pending',
          },
        });
      }
    }

    // Publish to all platforms in parallel
    const results = await Promise.allSettled(
      post.platforms.map(async (platform: string) => {
        const publisher = publishers[platform];
        if (!publisher) throw new Error(`Unknown platform: ${platform}`);

        try {
          const result = await publisher({
            title: post.title,
            description: post.description,
            videoUrl: post.videoUrl!,
          });

          await prisma.postResult.updateMany({
            where: { postId: post.id, platform: platform as string },
            data: {
              status: 'success',
              platformId: result.platformId || null,
              platformUrl: result.platformUrl || null,
            },
          });

          return { platform, status: 'success' as const, ...result };
        } catch (error: any) {
          await prisma.postResult.updateMany({
            where: { postId: post.id, platform: platform as string },
            data: {
              status: 'error',
              error: error.message || 'Unknown error',
            },
          });

          return { platform, status: 'error' as const, error: error.message };
        }
      })
    );

    // Determine overall status
    const allResults = results.map((r: any) => r.status === 'fulfilled' ? r.value : { status: 'error' });
    const hasSuccess = allResults.some((r: any) => r.status === 'success');
    const allFailed = allResults.every((r: any) => r.status === 'error');

    const finalStatus = allFailed ? 'FAILED' : 'PUBLISHED';

    // Always delete video from R2 after publishing attempts
    try {
      if (post.videoKey) {
        await deleteVideo(post.videoKey);
      }
    } finally {
      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: finalStatus,
          publishedAt: hasSuccess ? new Date() : null,
          videoUrl: null,
          videoKey: null,
        },
      });
    }

    const updatedPost = await prisma.post.findUnique({
      where: { id: post.id },
      include: { results: true },
    });

    return res.json(updatedPost);
  } catch (error) {
    console.error('Publish error:', error);
    return res.status(500).json({ error: 'Failed to publish' });
  }
});

export default router;
