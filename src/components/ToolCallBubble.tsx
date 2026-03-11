import React, { useState } from 'react';
import { ToolCallEntry } from '@/types/chat';
import { Loader2, CheckCircle2, XCircle, ChevronDown, ChevronRight, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolCallBubbleProps {
  call: ToolCallEntry;
}

export function ToolCallBubble({ call }: ToolCallBubbleProps) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    pending: <Loader2 size={12} className="text-text-secondary" />,
    running: <Loader2 size={12} className="text-yellow-500 animate-spin" />,
    done: <CheckCircle2 size={12} className="text-green-600" />,
    error: <XCircle size={12} className="text-red-500" />,
  }[call.status];

  const statusLabel = {
    pending: 'Queued',
    running: 'Running…',
    done: 'Done',
    error: 'Error',
  }[call.status];

  return (
    <div className={cn(
      'mt-2 border-2 border-glass-border shadow-[2px_2px_0px_var(--color-shadow-hard)] font-mono text-[10px]',
      call.status === 'error' && 'border-red-400',
      call.status === 'done' && 'border-green-500/40',
    )}>
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-black/5 transition-colors"
      >
        <Terminal size={11} className="text-text-secondary flex-shrink-0" />
        <span className="font-bold uppercase tracking-wider text-text-primary flex-1">
          {call.toolName}
        </span>
        <div className="flex items-center gap-1.5">
          {statusIcon}
          <span className={cn(
            'uppercase tracking-widest text-[8px] font-bold',
            call.status === 'done' ? 'text-green-700' :
            call.status === 'error' ? 'text-red-600' :
            call.status === 'running' ? 'text-yellow-600' : 'text-text-secondary',
          )}>
            {statusLabel}
          </span>
        </div>
        {expanded
          ? <ChevronDown size={11} className="text-text-secondary flex-shrink-0" />
          : <ChevronRight size={11} className="text-text-secondary flex-shrink-0" />
        }
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-glass-border divide-y divide-glass-border">
          {/* Args */}
          <div className="px-3 py-2">
            <div className="text-[8px] uppercase tracking-widest text-text-secondary mb-1 font-bold">Args</div>
            <pre className="text-[9px] leading-relaxed text-text-primary whitespace-pre-wrap break-all">
              {JSON.stringify(call.args, null, 2)}
            </pre>
          </div>
          {/* Result */}
          {call.result !== undefined && (
            <div className="px-3 py-2">
              <div className={cn(
                'text-[8px] uppercase tracking-widest mb-1 font-bold',
                call.status === 'error' ? 'text-red-600' : 'text-text-secondary',
              )}>
                {call.status === 'error' ? 'Error' : 'Result'}
              </div>
              <pre className={cn(
                'text-[9px] leading-relaxed whitespace-pre-wrap break-all max-h-48 overflow-y-auto',
                call.status === 'error' ? 'text-red-600' : 'text-text-primary',
              )}>
                {call.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
