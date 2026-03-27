import { Router, Request, Response } from 'express';
import prisma from '../../lib/db';
import { encrypt } from '../../lib/crypto';

const router = Router();

router.get('/auth', (_req: Request, res: Response) => {
  const csrfState = Math.random().toString(36).substring(2);
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    redirect_uri: process.env.TIKTOK_REDIRECT_URI!,
    scope: 'video.publish,video.upload',
    response_type: 'code',
    state: csrfState,
  });
  const url = `https://www.tiktok.com/v2/auth/authorize/?${params}`;
  return res.json({ url });
});

router.get('/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  try {
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: process.env.TIKTOK_REDIRECT_URI!,
      }),
    });

    const tokenData = await tokenRes.json() as any;

    if (!tokenData.access_token) {
      throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
    }

    // Get user info
    const userRes = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
      {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
      }
    );
    const userData = await userRes.json() as any;
    const user = userData.data?.user;

    await prisma.platformConnection.upsert({
      where: { platform: 'tiktok' },
      create: {
        platform: 'tiktok',
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
        accountName: user?.display_name || 'TikTok Account',
        accountId: user?.open_id || tokenData.open_id,
      },
      update: {
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : undefined,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
        accountName: user?.display_name || 'TikTok Account',
        accountId: user?.open_id || tokenData.open_id,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/settings?connected=tiktok`);
  } catch (error) {
    console.error('TikTok OAuth error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/settings?error=tiktok`);
  }
});

router.delete('/disconnect', async (_req: Request, res: Response) => {
  try {
    await prisma.platformConnection.delete({ where: { platform: 'tiktok' } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to disconnect' });
  }
});

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const connection = await prisma.platformConnection.findUnique({ where: { platform: 'tiktok' } });
    if (!connection) return res.json({ connected: false });

    const isExpired = connection.expiresAt ? new Date() >= connection.expiresAt : false;
    const isExpiringSoon = connection.expiresAt
      ? new Date() >= new Date(connection.expiresAt.getTime() - 24 * 60 * 60 * 1000)
      : false;

    return res.json({
      connected: true,
      accountName: connection.accountName,
      status: isExpired ? 'expired' : isExpiringSoon ? 'expiring' : 'active',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to check status' });
  }
});

export default router;
