import React from 'react';
import { cn } from '@/lib/utils';
import { motion, HTMLMotionProps } from 'motion/react';

interface GlassCardProps extends HTMLMotionProps<"div"> {
  variant?: 'default' | 'highlight' | 'ghost';
  hoverEffect?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = 'default', hoverEffect = false, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        whileHover={hoverEffect ? { y: -4, boxShadow: "8px 8px 0px #1A1A1A" } : undefined}
        className={cn(
          "rounded-lg border-2 transition-all duration-200",
          variant === 'default' && "bg-bg-app border-glass-border shadow-[4px_4px_0px_#1A1A1A]",
          variant === 'highlight' && "bg-white border-glass-border shadow-[4px_4px_0px_#1A1A1A]",
          variant === 'ghost' && "bg-transparent border-transparent shadow-none",
          className
        )}
        {...props}
      />
    );
  }
);
GlassCard.displayName = "GlassCard";
