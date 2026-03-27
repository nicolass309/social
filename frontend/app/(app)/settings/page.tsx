'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getPlatformStatus, getConnectUrl, disconnectPlatform } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ExternalLink, Unplug } from 'lucide-react';

interface PlatformInfo {
  id: string;
  label: string;
  icon: string;
  color: string;
}

const platformsList: PlatformInfo[] = [
  { id: 'youtube', label: 'YouTube', icon: '▶', color: 'bg-red-500' },
  { id: 'instagram', label: 'Instagram', icon: '📷', color: 'bg-gradient-to-br from-purple-500 to-pink-500' },
  { id: 'tiktok', label: 'TikTok', icon: '♪', color: 'bg-gray-900' },
];

interface PlatformStatus {
  connected: boolean;
  accountName?: string;
  status?: 'active' | 'expiring' | 'expired';
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [statuses, setStatuses] = useState<Record<string, PlatformStatus>>({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  const fetchStatuses = async () => {
    const results: Record<string, PlatformStatus> = {};
    await Promise.all(
      platformsList.map(async (p) => {
        try {
          results[p.id] = await getPlatformStatus(p.id);
        } catch {
          results[p.id] = { connected: false };
        }
      })
    );
    setStatuses(results);
    setLoading(false);
  };

  useEffect(() => {
    fetchStatuses();
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) toast.success(`${connected} connected successfully!`);
    if (error) toast.error(`Failed to connect ${error}`);
  }, [searchParams]);

  const handleConnect = async (platformId: string) => {
    setConnecting(platformId);
    try {
      const { url } = await getConnectUrl(platformId);
      window.location.href = url;
    } catch {
      toast.error('Failed to start connection');
      setConnecting(null);
    }
  };

  const handleDisconnect = async (platformId: string) => {
    if (!confirm('Are you sure you want to disconnect?')) return;
    try {
      await disconnectPlatform(platformId);
      setStatuses(prev => ({ ...prev, [platformId]: { connected: false } }));
      toast.success('Disconnected');
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Connected</Badge>;
      case 'expiring':
        return <Badge variant="warning">Token expiring</Badge>;
      case 'expired':
        return <Badge variant="destructive">Token expired</Badge>;
      default:
        return <Badge variant="secondary">Not connected</Badge>;
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Connect your social media accounts</p>
      </div>

      <div className="space-y-4">
        {loading
          ? [1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
          : platformsList.map((platform) => {
              const status = statuses[platform.id];
              return (
                <Card key={platform.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${platform.color} text-white text-xl`}>
                          {platform.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{platform.label}</h3>
                          {status?.connected ? (
                            <p className="text-sm text-gray-500">{status.accountName}</p>
                          ) : (
                            <p className="text-sm text-gray-400">No account connected</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {getStatusBadge(status?.connected ? status.status || 'active' : undefined)}
                        {status?.connected ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDisconnect(platform.id)}
                          >
                            <Unplug className="h-4 w-4 mr-1" />
                            Disconnect
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleConnect(platform.id)}
                            disabled={connecting === platform.id}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            {connecting === platform.id ? 'Connecting...' : 'Connect'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </div>
  );
}
