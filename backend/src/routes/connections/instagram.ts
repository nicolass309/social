import { Router, Request, Response } from 'express';
import prisma from '../../lib/db';
import { encrypt } from '../../lib/crypto';

const router = Router();

router.get('/auth', (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
    scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement',
    response_type: 'code',
  });
  const url = `https://www.facebook.com/v18.0/dialog/oauth?${params}`;
  return res.json({ url });
});

router.get('/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  try {
    // Exchange code for short-lived token
    const tokenRes = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.INSTAGRAM_APP_ID,
        client_secret: process.env.INSTAGRAM_APP_SECRET,
        redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
        code,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json() as any;

    if (!tokenData.access_token) {
      throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
    }

    // Exchange for long-lived token
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.INSTAGRAM_APP_ID}&client_secret=${process.env.INSTAGRAM_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`
    );
    const longTokenData = await longTokenRes.json() as any;
    const accessToken = longTokenData.access_token || tokenData.access_token;

    // Get Instagram Business Account ID
    const pagesRes = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json() as any;
    const page = pagesData.data?.[0];

    if (!page) throw new Error('No Facebook Page found');

    const igRes = await fetch(
      `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
    );
    const igData = await igRes.json() as any;
    const igAccountId = igData.instagram_business_account?.id;

    if (!igAccountId) throw new Error('No Instagram Business Account linked');

    // Get account info
    const igInfoRes = await fetch(
      `https://graph.facebook.com/v18.0/${igAccountId}?fields=username&access_token=${accessToken}`
    );
    const igInfo = await igInfoRes.json() as any;

    await prisma.platformConnection.upsert({
      where: { platform: 'instagram' },
      create: {
        platform: 'instagram',
        accessToken: encrypt(accessToken),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // ~60 days
        accountName: igInfo.username || 'Instagram Account',
        accountId: igAccountId,
      },
      update: {
        accessToken: encrypt(accessToken),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        accountName: igInfo.username || 'Instagram Account',
        accountId: igAccountId,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/settings?connected=instagram`);
  } catch (error) {
    console.error('Instagram OAuth error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/settings?error=instagram`);
  }
});

router.delete('/disconnect', async (_req: Request, res: Response) => {
  try {
    await prisma.platformConnection.delete({ where: { platform: 'instagram' } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to disconnect' });
  }
});

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const connection = await prisma.platformConnection.findUnique({ where: { platform: 'instagram' } });
    if (!connection) return res.json({ connected: false });

    const isExpired = connection.expiresAt ? new Date() >= connection.expiresAt : false;
    const isExpiringSoon = connection.expiresAt
      ? new Date() >= new Date(connection.expiresAt.getTime() - 7 * 24 * 60 * 60 * 1000)
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
