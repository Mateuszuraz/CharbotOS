import React from 'react';
import { cn } from '@/lib/utils';
import { motion, HTMLMotionProps } from 'motion/react';

interface GlassButtonProps extends HTMLMotionProps<"button"> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98, y: 0 }}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-mono font-bold tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border-2",
          
          // Variants
          variant === 'primary' && "bg-accent-primary text-bg-app border-accent-primary shadow-[4px_4px_0px_#1A1A1A] hover:shadow-[6px_6px_0px_#1A1A1A]",
          variant === 'secondary' && "bg-bg-app text-text-primary border-accent-primary shadow-[4px_4px_0px_#1A1A1A] hover:bg-black/5",
          variant === 'ghost' && "bg-transparent text-text-secondary border-transparent hover:text-text-primary hover:bg-black/5 shadow-none",
          variant === 'icon' && "bg-transparent text-text-secondary border-transparent hover:text-text-primary hover:bg-black/5 rounded-lg",

          // Sizes
          size === 'sm' && "text-xs px-3 py-1.5",
          size === 'md' && "text-sm px-4 py-2",
          size === 'lg' && "text-base px-6 py-3",
          size === 'icon' && "p-2",
          
          className
        )}
        {...props}
      />
    );
  }
);
GlassButton.displayName = "GlassButton";
