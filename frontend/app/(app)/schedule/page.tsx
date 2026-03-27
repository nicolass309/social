'use client';

import { useEffect, useState } from 'react';
import { getScheduledPosts } from '@/lib/api';
import { ScheduleCalendar } from '@/components/ScheduleCalendar';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlatformBadge } from '@/components/PlatformBadge';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function SchedulePage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    getScheduledPosts()
      .then(setPosts)
      .catch(() => toast.error('Failed to load scheduled posts'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
        <p className="text-sm text-gray-500 mt-1">View your upcoming scheduled posts</p>
      </div>

      {loading ? (
        <Skeleton className="h-[600px] w-full rounded-xl" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr,300px]">
          <ScheduleCalendar posts={posts} onPostClick={setSelected} />

          {selected ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{selected.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Scheduled for</p>
                    <p className="text-sm font-medium text-gray-900">
                      {format(new Date(selected.scheduledAt), 'MMM d, yyyy \'at\' HH:mm')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Platforms</p>
                    <div className="flex flex-wrap gap-1">
                      {selected.platforms.map((p: string) => (
                        <PlatformBadge key={p} platform={p} />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-gray-400 text-sm">
                Click a scheduled post to see details
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
