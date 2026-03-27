import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import uploadRoutes from './routes/upload';
import publishRoutes from './routes/publish';
import postsRoutes from './routes/posts';
import schedulerRoutes from './routes/scheduler';
import youtubeConnectionRoutes from './routes/connections/youtube';
import instagramConnectionRoutes from './routes/connections/instagram';
import tiktokConnectionRoutes from './routes/connections/tiktok';
import { initScheduler } from './lib/scheduler';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(helmet());
app.use(cookieParser());
app.use(express.json());

// Rate limiting for uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many uploads, please try again later' },
});

// Public routes
app.use('/api/auth', authRoutes);

// OAuth callback routes (public, they handle their own auth via state)
app.use('/api/connections/youtube', youtubeConnectionRoutes);
app.use('/api/connections/instagram', instagramConnectionRoutes);
app.use('/api/connections/tiktok', tiktokConnectionRoutes);

// Protected routes
app.use('/api/upload', authMiddleware, uploadLimiter, uploadRoutes);
app.use('/api/publish', authMiddleware, publishRoutes);
app.use('/api/posts', authMiddleware, postsRoutes);
app.use('/api/scheduler', authMiddleware, schedulerRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`ShortsPusher backend running on port ${PORT}`);
  initScheduler().catch(console.error);
});

export default app;
