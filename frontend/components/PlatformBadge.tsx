'use client';


const platformConfig: Record<string, { label: string; color: string }> = {
  youtube: { label: 'YouTube', color: 'bg-red-100 text-red-700' },
  instagram: { label: 'Instagram', color: 'bg-pink-100 text-pink-700' },
  tiktok: { label: 'TikTok', color: 'bg-gray-900 text-white' },
};

interface PlatformBadgeProps {
  platform: string;
  status?: 'success' | 'error' | 'pending';
}

export function PlatformBadge({ platform, status }: PlatformBadgeProps) {
  const config = platformConfig[platform] || { label: platform, color: '' };

  const statusIcon = status === 'success' ? '✓' : status === 'error' ? '✗' : status === 'pending' ? '…' : '';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.color}`}>
      {statusIcon && <span>{statusIcon}</span>}
      {config.label}
    </span>
  );
}
