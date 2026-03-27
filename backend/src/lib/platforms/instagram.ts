import prisma from '../db';
import { decrypt, encrypt } from '../crypto';

async function getInstagramCredentials() {
  const connection = await prisma.platformConnection.findUnique({
    where: { platform: 'instagram' },
  });

  if (!connection) throw new Error('Instagram not connected');

  const accessToken = decrypt(connection.accessToken);
  const accountId = connection.accountId;

  if (!accountId) throw new Error('Instagram account ID not found');

  return { accessToken, accountId };
}

async function waitForMediaProcessing(
  containerId: string,
  accessToken: string,
  maxAttempts = 20,
  intervalMs = 15000
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const data = await res.json() as any;

    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') {
      throw new Error(`Instagram media processing failed: ${JSON.stringify(data)}`);
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error('Instagram media processing timeout');
}

export async function publishToInstagram(post: {
  title: string;
  description: string;
  videoUrl: string;
}): Promise<{ platformId?: string; platformUrl?: string }> {
  const { accessToken, accountId } = await getInstagramCredentials();

  // Step 1: Create media container
  const createRes = await fetch(
    `https://graph.facebook.com/v18.0/${accountId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: post.videoUrl,
        caption: `${post.title}\n\n${post.description}`,
        access_token: accessToken,
      }),
    }
  );
  const createData = await createRes.json() as any;

  if (!createData.id) {
    throw new Error(`Failed to create Instagram media container: ${JSON.stringify(createData)}`);
  }

  // Step 2: Wait for processing
  await waitForMediaProcessing(createData.id, accessToken);

  // Step 3: Publish
  const publishRes = await fetch(
    `https://graph.facebook.com/v18.0/${accountId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: createData.id,
        access_token: accessToken,
      }),
    }
  );
  const publishData = await publishRes.json() as any;

  if (!publishData.id) {
    throw new Error(`Failed to publish Instagram media: ${JSON.stringify(publishData)}`);
  }

  return {
    platformId: publishData.id,
    platformUrl: `https://www.instagram.com/reel/${publishData.id}/`,
  };
}
