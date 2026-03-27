import prisma from '../db';
import { decrypt, encrypt } from '../crypto';

async function getTikTokCredentials() {
  const connection = await prisma.platformConnection.findUnique({
    where: { platform: 'tiktok' },
  });

  if (!connection) throw new Error('TikTok not connected');

  let accessToken = decrypt(connection.accessToken);

  // Auto-refresh if expired
  if (connection.expiresAt && new Date() >= connection.expiresAt && connection.refreshToken) {
    const refreshRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: decrypt(connection.refreshToken),
      }),
    });

    const refreshData = await refreshRes.json() as any;

    if (refreshData.access_token) {
      accessToken = refreshData.access_token;
      await prisma.platformConnection.update({
        where: { platform: 'tiktok' },
        data: {
          accessToken: encrypt(refreshData.access_token),
          refreshToken: refreshData.refresh_token ? encrypt(refreshData.refresh_token) : connection.refreshToken,
          expiresAt: refreshData.expires_in ? new Date(Date.now() + refreshData.expires_in * 1000) : null,
        },
      });
    }
  }

  return { accessToken };
}

export async function publishToTikTok(post: {
  title: string;
  description: string;
  videoUrl: string;
}): Promise<{ platformId?: string; platformUrl?: string }> {
  const { accessToken } = await getTikTokCredentials();

  // Fetch video from R2
  const videoRes = await fetch(post.videoUrl);
  const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

  // Step 1: Initialize upload
  const initRes = await fetch(
    'https://open.tiktokapis.com/v2/post/publish/video/init/',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: `${post.title}\n\n${post.description}`,
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoBuffer.length,
          chunk_size: videoBuffer.length,
          total_chunk_count: 1,
        },
      }),
    }
  );

  const initData = await initRes.json() as any;

  if (initData.error?.code !== 'ok' && !initData.data?.upload_url) {
    throw new Error(`TikTok init failed: ${JSON.stringify(initData)}`);
  }

  const uploadUrl = initData.data.upload_url;
  const publishId = initData.data.publish_id;

  // Step 2: Upload video
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Range': `bytes 0-${videoBuffer.length - 1}/${videoBuffer.length}`,
      'Content-Type': 'video/mp4',
    },
    body: videoBuffer,
  });

  if (!uploadRes.ok) {
    throw new Error(`TikTok upload failed: ${uploadRes.statusText}`);
  }

  // Step 3: Poll for status
  let attempts = 0;
  while (attempts < 30) {
    await new Promise(resolve => setTimeout(resolve, 10000));

    const statusRes = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publish_id: publishId }),
      }
    );

    const statusData = await statusRes.json() as any;

    if (statusData.data?.status === 'PUBLISH_COMPLETE') {
      return {
        platformId: publishId,
        platformUrl: undefined, // TikTok doesn't return URL directly
      };
    }

    if (statusData.data?.status === 'FAILED') {
      throw new Error(`TikTok publish failed: ${JSON.stringify(statusData)}`);
    }

    attempts++;
  }

  throw new Error('TikTok publish timeout');
}
