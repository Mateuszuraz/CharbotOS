import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface GlassInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoGrow?: boolean;
}

export const GlassInput = React.forwardRef<HTMLTextAreaElement, GlassInputProps>(
  ({ className, autoGrow = true, onChange, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const combinedRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;

    const adjustHeight = () => {
      if (autoGrow && combinedRef.current) {
        combinedRef.current.style.height = 'auto';
        combinedRef.current.style.height = `${Math.min(combinedRef.current.scrollHeight, 200)}px`;
      }
    };

    useEffect(() => {
      adjustHeight();
    }, [props.value]);

    return (
      <textarea
        ref={combinedRef}
        rows={1}
        onChange={(e) => {
          adjustHeight();
          onChange?.(e);
        }}
        className={cn(
          "glass-input w-full px-2 py-2 text-sm resize-none overflow-hidden bg-transparent border-b-2 border-glass-border focus:outline-none focus:border-black font-mono",
          className
        )}
        {...props}
      />
    );
  }
);
GlassInput.displayName = "GlassInput";
