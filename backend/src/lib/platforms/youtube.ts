import { google } from 'googleapis';
import { Readable } from 'stream';
import prisma from '../db';
import { decrypt, encrypt } from '../crypto';

async function getYouTubeClient() {
  const connection = await prisma.platformConnection.findUnique({
    where: { platform: 'youtube' },
  });

  if (!connection) throw new Error('YouTube not connected');

  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: decrypt(connection.accessToken),
    refresh_token: connection.refreshToken ? decrypt(connection.refreshToken) : undefined,
  });

  // Auto-refresh if expired
  if (connection.expiresAt && new Date() >= connection.expiresAt) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    await prisma.platformConnection.update({
      where: { platform: 'youtube' },
      data: {
        accessToken: encrypt(credentials.access_token!),
        refreshToken: credentials.refresh_token ? encrypt(credentials.refresh_token) : connection.refreshToken,
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      },
    });
    oauth2Client.setCredentials(credentials);
  }

  return google.youtube({ version: 'v3', auth: oauth2Client });
}

export async function publishToYouTube(post: {
  title: string;
  description: string;
  videoUrl: string;
}): Promise<{ platformId?: string; platformUrl?: string }> {
  const youtube = await getYouTubeClient();

  // Ensure #Shorts is in the title
  const title = post.title.includes('#Shorts')
    ? post.title
    : `${post.title} #Shorts`;

  // Fetch video from R2
  const response = await fetch(post.videoUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  const stream = Readable.from(buffer);

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description: post.description,
        categoryId: '22',
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: stream,
    },
  });

  const videoId = res.data.id;
  return {
    platformId: videoId || undefined,
    platformUrl: videoId ? `https://youtube.com/shorts/${videoId}` : undefined,
  };
}
