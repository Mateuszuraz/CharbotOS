import React, { memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { cn } from '@/lib/utils';
import {
  MessageSquare, Bot, Globe, Code, AlertCircle, CheckCircle2,
  Terminal, FileText, GitBranch, X,
} from 'lucide-react';
import { NodeData } from '@/types/automation';

const Icons: Record<string, any> = {
  MessageSquare,
  Bot,
  Globe,
  Code,
  Terminal,
  FileText,
  GitBranch,
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'running') return (
    <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
  );
  if (status === 'success') return <CheckCircle2 size={12} />;
  if (status === 'error') return <AlertCircle size={12} className="text-red-400" />;
  return null;
};

export const CustomNode = memo(({ id, data, selected }: NodeProps<NodeData>) => {
  const { deleteElements } = useReactFlow();
  const Icon = data.icon && Icons[data.icon] ? Icons[data.icon] : Code;
  const status = data.status || 'idle';
  const isCondition = data.nodeType === 'condition';

  return (
    <div className={cn(
      'group min-w-[200px] rounded-lg border-2 transition-all duration-150',
      'bg-bg-app border-glass-border',
      'shadow-[4px_4px_0px_var(--color-shadow-hard)]',
      selected
        ? 'border-text-primary ring-2 ring-text-primary ring-offset-2 ring-offset-bg-app'
        : 'hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_var(--color-shadow-hard)]',
    )}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b-2 border-glass-border flex items-center justify-between rounded-t-lg bg-text-primary text-bg-app">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-0.5 rounded bg-bg-app/15 flex-shrink-0">
            <Icon size={11} />
          </div>
          <span className="text-[10px] font-bold tracking-wide uppercase font-mono truncate">{data.label}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <StatusIcon status={status} />
          <button
            onClick={() => deleteElements({ nodes: [{ id }] })}
            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 hover:bg-bg-app/20 rounded transition-opacity"
            title="Delete node"
          >
            <X size={10} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 text-[11px] text-text-primary font-mono min-h-[40px]">
        {data.nodeType === 'llm-generate' && (
          <div className="truncate opacity-60">Model: {data.config?.model || 'Default'}</div>
        )}
        {data.nodeType === 'http-request' && (
          <div className="truncate opacity-60">{data.config?.method || 'GET'} {data.config?.url || '/'}</div>
        )}
        {data.nodeType === 'chat-trigger' && (
          <div className="opacity-60">On: {data.config?.event || 'Any Message'}</div>
        )}
        {data.nodeType === 'shell-command' && (
          <div className="truncate opacity-60">&gt; {data.config?.command || 'echo "Hello"'}</div>
        )}
        {data.nodeType === 'file-operation' && (
          <div className="truncate opacity-60">{data.config?.operation || 'read'}: {data.config?.path || './'}</div>
        )}
        {data.nodeType === 'javascript' && (
          <div className="truncate opacity-60">
            {(data.config?.code || 'return input;').split('\n')[0].slice(0, 28)}
          </div>
        )}
        {data.nodeType === 'condition' && (
          <div className="space-y-1.5">
            <div className="truncate opacity-60">if ({data.config?.expression || 'true'})</div>
            <div className="flex gap-3 text-[9px] font-bold">
              <span className="text-green-600 dark:text-green-400">● TRUE</span>
              <span className="text-red-500 dark:text-red-400">● FALSE</span>
            </div>
          </div>
        )}
        {!data.nodeType && (
          <div className="truncate opacity-60">{data.label}</div>
        )}
      </div>

      {/* Success output preview */}
      {status === 'success' && data.output != null && (
        <div className="px-4 pb-2.5 pt-1.5 border-t border-glass-border/40 text-[9px] font-mono text-text-secondary truncate">
          ✓ {typeof data.output === 'object'
            ? JSON.stringify(data.output).slice(0, 44)
            : String(data.output).slice(0, 44)}
        </div>
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-bg-app !border-2 !border-glass-border !rounded-none"
      />

      {isCondition ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            style={{ top: '38%' }}
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-glass-border !rounded-none"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            style={{ top: '62%' }}
            className="!w-3 !h-3 !bg-red-400 !border-2 !border-glass-border !rounded-none"
          />
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-bg-app !border-2 !border-glass-border !rounded-none"
        />
      )}
    </div>
  );
});
