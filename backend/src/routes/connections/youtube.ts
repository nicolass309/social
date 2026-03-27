import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import prisma from '../../lib/db';
import { encrypt, decrypt } from '../../lib/crypto';

const router = Router();

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );
}

router.get('/auth', (_req: Request, res: Response) => {
  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
  });
  return res.json({ url });
});

router.get('/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    // Get channel info
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const channelRes = await youtube.channels.list({
      part: ['snippet'],
      mine: true,
    });

    const channel = channelRes.data.items?.[0];
    const channelName = channel?.snippet?.title || 'Unknown';
    const channelId = channel?.id || '';

    await prisma.platformConnection.upsert({
      where: { platform: 'youtube' },
      create: {
        platform: 'youtube',
        accessToken: encrypt(tokens.access_token!),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        accountName: channelName,
        accountId: channelId,
      },
      update: {
        accessToken: encrypt(tokens.access_token!),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        accountName: channelName,
        accountId: channelId,
      },
    });

    // Redirect to frontend settings page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/settings?connected=youtube`);
  } catch (error) {
    console.error('YouTube OAuth error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/settings?error=youtube`);
  }
});

router.delete('/disconnect', async (_req: Request, res: Response) => {
  try {
    await prisma.platformConnection.delete({
      where: { platform: 'youtube' },
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to disconnect YouTube' });
  }
});

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const connection = await prisma.platformConnection.findUnique({
      where: { platform: 'youtube' },
    });

    if (!connection) return res.json({ connected: false });

    const isExpired = connection.expiresAt ? new Date() >= connection.expiresAt : false;
    const isExpiringSoon = connection.expiresAt
      ? new Date() >= new Date(connection.expiresAt.getTime() - 24 * 60 * 60 * 1000)
      : false;

    return res.json({
      connected: true,
      accountName: connection.accountName,
      accountId: connection.accountId,
      status: isExpired ? 'expired' : isExpiringSoon ? 'expiring' : 'active',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to check status' });
  }
});

export default router;
