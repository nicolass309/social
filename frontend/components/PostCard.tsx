'use client';

import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { PlatformBadge } from '@/components/PlatformBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Trash2, RotateCcw } from 'lucide-react';

interface PostResult {
  id: string;
  platform: string;
  status: string;
  platformUrl?: string | null;
  error?: string | null;
}

interface Post {
  id: string;
  title: string;
  description: string;
  platforms: string[];
  status: string;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  videoUrl?: string | null;
  results: PostResult[];
}

interface PostCardProps {
  post: Post;
  onDelete?: (id: string) => void;
  onRetry?: (id: string) => void;
}

const statusVariant: Record<string, any> = {
  DRAFT: 'secondary',
  SCHEDULED: 'default',
  PUBLISHING: 'warning',
  PUBLISHED: 'success',
  FAILED: 'destructive',
};

export function PostCard({ post, onDelete, onRetry }: PostCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-gray-900 truncate">{post.title}</h3>
              <Badge variant={statusVariant[post.status] || 'secondary'}>
                {post.status}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {post.results.length > 0
                ? post.results.map((r) => (
                    <div key={r.id} className="flex items-center gap-1">
                      <PlatformBadge platform={r.platform} status={r.status as any} />
                      {r.platformUrl && (
                        <a href={r.platformUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 text-gray-400 hover:text-indigo-500" />
                        </a>
                      )}
                    </div>
                  ))
                : post.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}
            </div>

            <p className="text-xs text-gray-400">
              {post.publishedAt
                ? `Published ${format(new Date(post.publishedAt), 'MMM d, yyyy HH:mm')}`
                : post.scheduledAt
                ? `Scheduled for ${format(new Date(post.scheduledAt), 'MMM d, yyyy HH:mm')}`
                : `Created ${format(new Date(post.createdAt), 'MMM d, yyyy HH:mm')}`}
            </p>

            {post.status === 'FAILED' && !post.videoUrl && (
              <p className="text-xs text-amber-600 mt-1">
                Video deleted from server. Upload again to retry.
              </p>
            )}

            {post.results.filter(r => r.error).map(r => (
              <p key={r.id} className="text-xs text-red-500 mt-1">
                {r.platform}: {r.error}
              </p>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {post.status === 'FAILED' && onRetry && (
              <Button variant="ghost" size="icon" onClick={() => onRetry(post.id)} title="Retry">
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="icon" onClick={() => onDelete(post.id)} title="Delete">
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
