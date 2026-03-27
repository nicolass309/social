'use client';

import { useEffect, useState } from 'react';
import { getPosts, deletePost } from '@/lib/api';
import { PostCard } from '@/components/PostCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';

type FilterType = 'all' | 'PUBLISHED' | 'SCHEDULED' | 'FAILED';

export default function DashboardPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  const fetchPosts = async () => {
    try {
      const data = await getPosts();
      setPosts(data);
    } catch {
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      await deletePost(id);
      setPosts(posts.filter(p => p.id !== id));
      toast.success('Post deleted');
    } catch {
      toast.error('Failed to delete post');
    }
  };

  const handleRetry = async (_id: string) => {
    toast.info('To retry, create a new post with the video re-uploaded.');
  };

  const filtered = filter === 'all' ? posts : posts.filter(p => p.status === filter);

  const filters: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Published', value: 'PUBLISHED' },
    { label: 'Scheduled', value: 'SCHEDULED' },
    { label: 'Failed', value: 'FAILED' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your published and scheduled content</p>
        </div>
        <Link href="/new">
          <Button>
            <PlusCircle className="h-4 w-4 mr-2" />
            New Post
          </Button>
        </Link>
      </div>

      <div className="flex gap-2 mb-6">
        {filters.map(f => (
          <Button
            key={f.value}
            variant={filter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No posts yet</p>
          <Link href="/new">
            <Button variant="outline" className="mt-4">Create your first post</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onDelete={handleDelete}
              onRetry={handleRetry}
            />
          ))}
        </div>
      )}
    </div>
  );
}
