/**
 * ChatContextMenu — custom right-click / long-press context menu for chat bubbles.
 * Design language: brutalist ink-bleed, JetBrains Mono, hard shadows.
 */
import React, { useEffect, useRef } from 'react';
import { Copy, Clipboard, BookmarkPlus, Reply, Repeat2, Trash2, ScanText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export interface ChatContextAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  dividerBefore?: boolean;
  onClick: () => void;
}

interface ChatContextMenuProps {
  x: number;
  y: number;
  actions: ChatContextAction[];
  onClose: () => void;
}

export function ChatContextMenu({ x, y, actions, onClose }: ChatContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Clamp to viewport
  const [pos, setPos] = React.useState({ x, y });
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPos({
      x: Math.min(x, vw - rect.width - 8),
      y: Math.min(y, vh - rect.height - 8),
    });
  }, [x, y]);

  // Close on outside click / Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick, true);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick, true);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.9, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -4 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999 }}
      className="min-w-[168px] bg-bg-app border-2 border-glass-border shadow-[4px_4px_0px_var(--color-shadow-hard)] overflow-hidden"
      onContextMenu={e => e.preventDefault()}
    >
      {actions.map((action) => (
        <React.Fragment key={action.id}>
          {action.dividerBefore && (
            <div className="border-t-2 border-glass-border" />
          )}
          <button
            onClick={() => { action.onClick(); onClose(); }}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-mono tracking-wide transition-colors',
              action.danger
                ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600'
                : 'text-text-primary hover:bg-text-primary hover:text-bg-app',
            )}
          >
            <span className="flex-shrink-0 opacity-70">{action.icon}</span>
            {action.label}
          </button>
        </React.Fragment>
      ))}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Hook: useChatContextMenu
// Returns event handler to attach to a message bubble + rendered menu element.
// ---------------------------------------------------------------------------

interface UseChatContextMenuOptions {
  content: string;
  isUser: boolean;
  onReply?: () => void;
  onDelete?: () => void;
  onSaveDoc?: () => void;
  onCopyRaw?: () => void;
}

export function useChatContextMenu({
  content,
  isUser,
  onReply,
  onDelete,
  onSaveDoc,
  onCopyRaw,
}: UseChatContextMenuOptions) {
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = React.useState(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  // Copy currently selected text if any, else full message
  const handleCopy = () => {
    const sel = window.getSelection()?.toString();
    copyText(sel && sel.trim().length > 0 ? sel : content);
  };

  const handleCopyRaw = () => {
    copyText(content);
    onCopyRaw?.();
  };

  const actions: ChatContextAction[] = [
    {
      id: 'copy',
      label: 'Kopiuj',
      icon: <Copy size={12} />,
      onClick: handleCopy,
    },
    {
      id: 'copy_raw',
      label: 'Kopiuj jako tekst',
      icon: <ScanText size={12} />,
      onClick: handleCopyRaw,
    },
    ...(onReply ? [{
      id: 'reply',
      label: 'Odpowiedz',
      icon: <Reply size={12} />,
      dividerBefore: true,
      onClick: onReply,
    }] : []),
    ...(onSaveDoc ? [{
      id: 'save_doc',
      label: 'Zapisz jako dokument',
      icon: <BookmarkPlus size={12} />,
      onClick: onSaveDoc,
    }] : []),
    ...(onDelete ? [{
      id: 'delete',
      label: 'Usuń wiadomość',
      icon: <Trash2 size={12} />,
      danger: true,
      dividerBefore: true,
      onClick: onDelete,
    }] : []),
  ];

  const menuEl = (
    <AnimatePresence>
      {menu && (
        <ChatContextMenu
          x={menu.x}
          y={menu.y}
          actions={actions}
          onClose={() => setMenu(null)}
        />
      )}
    </AnimatePresence>
  );

  return { handleContextMenu, menuEl, copied };
}
