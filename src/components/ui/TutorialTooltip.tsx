import React, { useState, useRef, useCallback } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useLanguage } from '@/context/LanguageContext';
import { TUTORIALS, TutorialKey } from '@/lib/tutorialContent';
import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TutorialTooltipProps {
  tutorialKey: TutorialKey;
  position?: 'top' | 'right' | 'bottom' | 'left';
  children: React.ReactNode;
  className?: string;
}

export function TutorialTooltip({
  tutorialKey,
  position = 'right',
  children,
  className,
}: TutorialTooltipProps) {
  const { settings } = useSettings();
  const { lang } = useLanguage();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const content = TUTORIALS[lang]?.[tutorialKey] ?? TUTORIALS.en[tutorialKey];

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), 300);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  if (!settings.tutorialEnabled) return <>{children}</>;

  const posClass = {
    right: 'left-full top-1/2 -translate-y-1/2 ml-3',
    left: 'right-full top-1/2 -translate-y-1/2 mr-3',
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-3',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-3',
  }[position];

  return (
    <div
      className={cn('relative', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}

      {visible && (
        <div
          className={cn(
            'absolute z-[500] min-w-[220px] max-w-[280px] pointer-events-none',
            posClass,
          )}
        >
          {/* Arrow */}
          {position === 'right' && (
            <div className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-r-[6px] border-t-transparent border-b-transparent border-r-text-primary" />
          )}
          {position === 'left' && (
            <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-l-[6px] border-t-transparent border-b-transparent border-l-text-primary" />
          )}
          {position === 'bottom' && (
            <div className="absolute top-[-6px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-l-transparent border-r-transparent border-b-text-primary" />
          )}
          {position === 'top' && (
            <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-text-primary" />
          )}

          {/* Panel */}
          <div className="bg-bg-app border-2 border-text-primary shadow-[4px_4px_0px_var(--color-shadow-hard)] p-3">
            {/* Badge */}
            <div className="flex items-center gap-1.5 mb-2">
              <GraduationCap size={10} className="text-text-secondary" />
              <span className="text-[8px] font-bold font-mono uppercase tracking-[0.15em] text-text-secondary">
                Tutorial
              </span>
            </div>

            {/* Title */}
            <p className="text-[11px] font-bold font-mono uppercase tracking-wide text-text-primary mb-1.5 leading-tight">
              {content.title}
            </p>

            {/* Description */}
            <p className="text-[10px] font-mono text-text-secondary leading-relaxed">
              {content.description}
            </p>

            {/* Tip */}
            {content.tip && (
              <div className="mt-2 pt-2 border-t border-glass-border">
                <p className="text-[9px] font-mono text-text-secondary leading-snug">
                  <span className="font-bold text-text-primary">Tip: </span>
                  {content.tip}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
