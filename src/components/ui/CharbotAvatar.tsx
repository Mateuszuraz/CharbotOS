import React from 'react';
import { cn } from '@/lib/utils';

interface CharbotAvatarProps {
  className?: string;
  emotion?: 'neutral' | 'happy' | 'thinking';
}

export function CharbotAvatar({ className }: CharbotAvatarProps) {
  return (
    <div className={cn("relative w-full h-full overflow-hidden bg-black", className)}>
      <video
        src="/avatar.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-contain"
      />
    </div>
  );
}
