'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPost, publishPost, getPlatformStatus } from '@/lib/api';
import { VideoUploader } from '@/components/VideoUploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { AlertTriangle, Send, Clock } from 'lucide-react';

const platforms = [
  { id: 'youtube', label: 'YouTube Shorts', icon: '▶' },
  { id: 'instagram', label: 'Instagram Reels', icon: '📷' },
  { id: 'tiktok', label: 'TikTok', icon: '♪' },
];

export default function NewPostPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [videoData, setVideoData] = useState<{ url: string; key: string } | null>(null);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [connectedPlatforms, setConnectedPlatforms] = useState<Record<string, boolean>>({});

  useEffect(() => {
    platforms.forEach(async (p) => {
      try {
        const status = await getPlatformStatus(p.id);
        setConnectedPlatforms(prev => ({ ...prev, [p.id]: status.connected }));
      } catch {
        setConnectedPlatforms(prev => ({ ...prev, [p.id]: false }));
      }
    });
  }, []);

  const togglePlatform = (id: string) => {
    if (!connectedPlatforms[id]) return;
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!videoData) return toast.error('Please upload a video');
    if (!title.trim()) return toast.error('Please enter a title');
    if (selectedPlatforms.length === 0) return toast.error('Select at least one platform');

    if (isScheduled) {
      if (!scheduleDate || !scheduleTime) return toast.error('Please set schedule date and time');
      const scheduled = new Date(`${scheduleDate}T${scheduleTime}`);
      if (scheduled <= new Date()) return toast.error('Schedule must be in the future');
    }

    setSubmitting(true);
    try {
      const scheduledAt = isScheduled ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString() : undefined;

      const post = await createPost({
        title,
        description,
        videoUrl: videoData.url,
        videoKey: videoData.key,
        platforms: selectedPlatforms,
        scheduledAt,
        hashtags: hashtags || undefined,
      });

      if (!isScheduled) {
        toast.info('Publishing to platforms...');
        await publishPost(post.id);
        toast.success('Published successfully!');
      } else {
        toast.success('Post scheduled!');
      }

      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Post</h1>
        <p className="text-sm text-gray-500 mt-1">Create and publish a short video across platforms</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Video</CardTitle>
            </CardHeader>
            <CardContent>
              <VideoUploader
                onUploaded={setVideoData}
                onRemove={() => setVideoData(null)}
                uploaded={videoData}
              />
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  The video will be deleted from the server once published.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Title</label>
                  <span className="text-xs text-gray-400">{title.length}/100</span>
                </div>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                  placeholder="My awesome short video"
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Description</label>
                  <span className="text-xs text-gray-400">{description.length}/2200</span>
                </div>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 2200))}
                  placeholder="Write a description..."
                  rows={4}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Hashtags</label>
                <Input
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="viral, shorts, trending"
                />
                <p className="text-xs text-gray-400 mt-1">Separate with commas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Platforms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {platforms.map(p => {
                const connected = connectedPlatforms[p.id];
                const selected = selectedPlatforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    disabled={!connected}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-colors text-left ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50'
                        : connected
                        ? 'border-gray-200 hover:border-gray-300'
                        : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-lg">{p.icon}</span>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">{p.label}</span>
                      {!connected && (
                        <p className="text-xs text-gray-400">Not connected</p>
                      )}
                    </div>
                    {selected && (
                      <div className="h-5 w-5 rounded-full bg-indigo-500 flex items-center justify-center">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Button
                  variant={!isScheduled ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setIsScheduled(false)}
                >
                  <Send className="h-4 w-4 mr-1" /> Now
                </Button>
                <Button
                  variant={isScheduled ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setIsScheduled(true)}
                >
                  <Clock className="h-4 w-4 mr-1" /> Schedule
                </Button>
              </div>
              {isScheduled && (
                <div className="space-y-3">
                  <Input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={submitting || !videoData || !title || selectedPlatforms.length === 0}
          >
            {submitting
              ? 'Processing...'
              : isScheduled
              ? 'Schedule Post'
              : 'Publish Now'}
          </Button>
        </div>
      </div>
    </div>
  );
}
