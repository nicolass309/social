# ShortsPusher

Multi-platform short video publisher. Upload once, publish to YouTube Shorts, Instagram Reels, and TikTok simultaneously.

## Features

- **Multi-platform publishing** — YouTube Shorts, Instagram Reels, TikTok
- **Scheduled posting** — Set a date/time and the system publishes automatically
- **Automatic cleanup** — Videos are deleted from storage after publishing
- **OAuth integration** — Secure token management with AES-256-GCM encryption
- **Clean UI** — Modern interface built with Next.js, Tailwind CSS, and shadcn/ui components

## Architecture

```
Frontend (Next.js 14)          Backend (Express)
    Vercel                         Render
       │                              │
       └──── REST API (JSON) ─────────┘
                                      │
                              ┌───────┼───────┐
                              │       │       │
                           YouTube  Instagram TikTok
                              │       │       │
                              └───────┼───────┘
                                      │
                              PostgreSQL + R2
```

## Prerequisites

- **Node.js 18+** and npm
- **PostgreSQL** database (Render PostgreSQL or [Neon.tech](https://neon.tech))
- **Cloudflare R2** account for video storage
- **Vercel** account for frontend deployment
- **Render** account for backend deployment
- Platform developer accounts (see setup guides below)

## Platform Setup Guides

### 1. YouTube (Google Cloud Console)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable **YouTube Data API v3** in APIs & Services > Library
4. Go to APIs & Services > Credentials
5. Click **Create Credentials > OAuth 2.0 Client ID**
6. Application type: **Web application**
7. Add authorized redirect URI: `https://your-backend.render.com/api/connections/youtube/callback`
8. Copy the **Client ID** and **Client Secret**
9. Go to OAuth consent screen > Configure:
   - Add scopes: `youtube.upload`, `youtube.readonly`
   - Add test users if app is in "Testing" mode

### 2. Instagram (Meta Developer Portal)

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app (type: **Business**)
3. Add **Instagram Graph API** product
4. Add **Facebook Login** product
5. In Facebook Login > Settings:
   - Add Valid OAuth Redirect URI: `https://your-backend.render.com/api/connections/instagram/callback`
6. In App Settings > Basic, copy **App ID** and **App Secret**
7. Requirements:
   - A Facebook Page linked to an Instagram Business/Creator Account
   - The Instagram account must be a Business or Creator account
   - App must have `instagram_basic`, `instagram_content_publish`, `pages_show_list` permissions

### 3. TikTok (TikTok Developer Portal)

1. Go to [TikTok for Developers](https://developers.tiktok.com/)
2. Create a new app
3. Add **Login Kit** and **Content Posting API** products
4. In app settings:
   - Add redirect URI: `https://your-backend.render.com/api/connections/tiktok/callback`
   - Request scopes: `video.publish`, `video.upload`
5. Copy the **Client Key** and **Client Secret**
6. Submit for review (required for Content Posting API)

### 4. Cloudflare R2 Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) > R2
2. Create a new bucket (e.g., `shortspusher-videos`)
3. Enable **Public Access** on the bucket (Settings > Public access)
4. Go to R2 > Manage R2 API tokens
5. Create a new API token with **Object Read & Write** permissions
6. Copy: **Account ID**, **Access Key ID**, **Secret Access Key**
7. Note the public URL format: `https://pub-{hash}.r2.dev`

## Quick Start (Local Development)

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd social-automate

# 2. Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 3. Configure environment
cp .env.example backend/.env
# Edit backend/.env with your credentials

# 4. Setup database
cd backend
npx prisma generate
npx prisma db push
cd ..

# 5. Start backend (terminal 1)
cd backend && npm run dev

# 6. Start frontend (terminal 2)
cd frontend && npm run dev

# 7. Open http://localhost:3000
```

## Automated Deployment

```bash
# Run the deploy script
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

The script will:
1. Check prerequisites (Node.js, Vercel CLI, etc.)
2. Ask for missing credentials interactively
3. Generate JWT_SECRET and ENCRYPTION_KEY automatically
4. Run database migrations
5. Deploy backend to Render
6. Deploy frontend to Vercel
7. Show a summary with all URLs and redirect URIs to configure

## Environment Variables

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | JWT signing secret (auto-generated) |
| `APP_USERNAME` | Login username (default: admin) |
| `APP_PASSWORD` | Login password |
| `ENCRYPTION_KEY` | 32-char key for AES-256-GCM encryption (auto-generated) |
| `DATABASE_URL` | PostgreSQL connection string |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API access key |
| `R2_SECRET_ACCESS_KEY` | R2 API secret |
| `R2_BUCKET_NAME` | R2 bucket name |
| `R2_PUBLIC_URL` | R2 public access URL |
| `YOUTUBE_CLIENT_ID` | Google OAuth client ID |
| `YOUTUBE_CLIENT_SECRET` | Google OAuth client secret |
| `YOUTUBE_REDIRECT_URI` | YouTube OAuth callback URL |
| `INSTAGRAM_APP_ID` | Meta app ID |
| `INSTAGRAM_APP_SECRET` | Meta app secret |
| `INSTAGRAM_REDIRECT_URI` | Instagram OAuth callback URL |
| `TIKTOK_CLIENT_KEY` | TikTok client key |
| `TIKTOK_CLIENT_SECRET` | TikTok client secret |
| `TIKTOK_REDIRECT_URI` | TikTok OAuth callback URL |
| `FRONTEND_URL` | Frontend URL (for CORS) |
| `NEXT_PUBLIC_API_URL` | Backend URL (for frontend) |

## Video Lifecycle

1. User uploads video → Stored in Cloudflare R2
2. Post is created → Video URL saved in database
3. Publishing begins → Video streamed from R2 to each platform
4. Publishing completes (success or failure) → Video **deleted from R2**
5. For scheduled posts → Video kept in R2 until publish time, then deleted

> **Important:** Videos are always deleted after publishing attempts. Users must re-upload to retry failed posts.

## Troubleshooting

### "YouTube upload fails with 403"
- Ensure the YouTube Data API v3 is enabled
- Check that OAuth scopes include `youtube.upload`
- If app is in "Testing" mode, add your Google account as a test user

### "Instagram says 'No Instagram Business Account'"
- Your Instagram account must be a Business or Creator account
- It must be linked to a Facebook Page
- The Facebook Page must be visible to the Meta app

### "TikTok Content Posting API unavailable"
- The Content Posting API requires app review and approval from TikTok
- During development, use the TikTok Sandbox environment

### "CORS errors in browser"
- Ensure `FRONTEND_URL` in backend `.env` matches your actual frontend URL
- Include the protocol (`https://`)

### "OAuth redirect mismatch"
- Redirect URIs must match **exactly** (including trailing slashes)
- Update redirect URIs in both the platform's developer console and your `.env`

### "Database connection fails"
- Check that `DATABASE_URL` is a valid PostgreSQL connection string
- Ensure the database server allows connections from your IP/Render's IP
- For Neon.tech, make sure to include `?sslmode=require`

## Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Lucide icons
- **Backend:** Express, TypeScript, Prisma ORM, pg-boss
- **Database:** PostgreSQL
- **Storage:** Cloudflare R2 (S3-compatible)
- **Auth:** JWT (httpOnly cookies), AES-256-GCM token encryption
- **Deploy:** Vercel (frontend) + Render (backend)

## License

MIT
