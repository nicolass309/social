import prisma from './db';
import { publishToYouTube } from './platforms/youtube';
import { publishToInstagram } from './platforms/instagram';
import { publishToTikTok } from './platforms/tiktok';
import { deleteVideo } from './storage';

let boss: any = null;

const publishers: Record<string, (post: any) => Promise<any>> = {
  youtube: publishToYouTube,
  instagram: publishToInstagram,
  tiktok: publishToTikTok,
};

export async function initScheduler() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not set, scheduler disabled');
    return;
  }

  const { PgBoss } = require('pg-boss');
  boss = new PgBoss(process.env.DATABASE_URL);

  boss.on('error', (error: any) => console.error('pg-boss error:', error));

  await boss.start();
  console.log('pg-boss scheduler started');

  // Create queue first, then schedule cron
  await boss.createQueue('check-scheduled-posts');
  await boss.schedule('check-scheduled-posts', '*/5 * * * *');

  await boss.work('check-scheduled-posts', async () => {
    await processScheduledPosts();
  });

  console.log('Scheduled posts checker registered');
}

async function processScheduledPosts() {
  const now = new Date();
  const posts = await prisma.post.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: now },
    },
    include: { results: true },
  });

  console.log(`Found ${posts.length} posts to publish`);

  for (const post of posts) {
    if (!post.videoUrl) {
      await prisma.post.update({
        where: { id: post.id },
        data: { status: 'FAILED' },
      });
      continue;
    }

    await prisma.post.update({
      where: { id: post.id },
      data: { status: 'PUBLISHING' },
    });

    try {
      // Create pending results
      for (const platform of post.platforms) {
        const existing = post.results.find(r => r.platform === platform);
        if (!existing) {
          await prisma.postResult.create({
            data: { postId: post.id, platform, status: 'pending' },
          });
        }
      }

      const results = await Promise.allSettled(
        post.platforms.map(async (platform) => {
          const publisher = publishers[platform];
          if (!publisher) throw new Error(`Unknown platform: ${platform}`);

          try {
            const result = await publisher({
              title: post.title,
              description: post.description,
              videoUrl: post.videoUrl!,
            });

            await prisma.postResult.updateMany({
              where: { postId: post.id, platform },
              data: {
                status: 'success',
                platformId: result.platformId,
                platformUrl: result.platformUrl,
              },
            });

            return { platform, status: 'success' as const };
          } catch (error: any) {
            await prisma.postResult.updateMany({
              where: { postId: post.id, platform },
              data: { status: 'error', error: error.message },
            });
            return { platform, status: 'error' as const };
          }
        })
      );

      const allResults = results.map(r => r.status === 'fulfilled' ? r.value : { status: 'error' });
      const hasSuccess = allResults.some(r => r.status === 'success');
      const allFailed = allResults.every(r => r.status === 'error');

      const finalStatus = allFailed ? 'FAILED' : 'PUBLISHED';

      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: finalStatus,
          publishedAt: hasSuccess ? new Date() : null,
          videoUrl: null,
          videoKey: null,
        },
      });
    } catch (error) {
      console.error(`Failed to process post ${post.id}:`, error);
      await prisma.post.update({
        where: { id: post.id },
        data: { status: 'FAILED' },
      });
    } finally {
      // Always delete video from R2
      if (post.videoKey) {
        await deleteVideo(post.videoKey);
      }
    }
  }
}

export async function stopScheduler() {
  if (boss) {
    await boss.stop();
    boss = null;
  }
}
