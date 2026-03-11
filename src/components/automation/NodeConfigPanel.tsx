import React, { useEffect, useState } from 'react';
import { Node } from 'reactflow';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { GlassButton } from '@/components/ui/GlassButton';
import { X, Save, Copy } from 'lucide-react';
import { NodeData } from '@/types/automation';

interface NodeConfigPanelProps {
  node: Node<NodeData> | null;
  onUpdate: (id: string, data: Partial<NodeData>) => void;
  onClose: () => void;
  onDuplicate?: (id: string) => void;
}

export function NodeConfigPanel({ node, onUpdate, onClose, onDuplicate }: NodeConfigPanelProps) {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (node) {
      setConfig(node.data.config || {});
      setLabel(node.data.label || '');
    }
  }, [node?.id]);

  if (!node) return null;

  const handleSave = () => {
    onUpdate(node.id, { label, config });
  };

  const set = (key: string, value: any) => setConfig(prev => ({ ...prev, [key]: value }));

  const renderConfigFields = () => {
    switch (node.data.nodeType) {
      case 'llm-generate':
        return (
          <>
            <Field label="Provider">
              <select
                className="w-full bg-transparent border-b-2 border-glass-border text-text-primary text-xs font-mono py-2 focus:outline-none focus:border-text-primary transition-colors"
                value={config.provider || 'ollama'}
                onChange={e => set('provider', e.target.value)}
              >
                <option value="ollama">Ollama (local)</option>
                <option value="openai">OpenAI</option>
                <option value="google">Google Gemini</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </Field>
            <Field label="Model">
              <GlassInput
                value={config.model || ''}
                onChange={e => set('model', e.target.value)}
                placeholder={
                  config.provider === 'openai' ? 'gpt-4o' :
                  config.provider === 'google' ? 'gemini-2.5-flash-latest' :
                  config.provider === 'anthropic' ? 'claude-sonnet-4-6' :
                  'llama3.2'
                }
              />
            </Field>
            <Field label="Prompt">
              <div className="text-[9px] font-mono text-text-secondary mb-1">
                Użyj <code className="bg-black/5 px-1">{'{{input}}'}</code> aby wstrzyknąć output poprzedniego węzła.
              </div>
              <textarea
                value={config.prompt || ''}
                onChange={e => set('prompt', e.target.value)}
                placeholder={'Przetłumacz na angielski: {{input}}'}
                rows={4}
                className="w-full bg-transparent border-b-2 border-glass-border text-text-primary placeholder:text-text-secondary/50 focus:border-text-primary focus:outline-none text-xs font-mono py-1 resize-none transition-colors"
              />
            </Field>
            <Field label="System Prompt (opcjonalny)">
              <textarea
                value={config.systemPrompt || ''}
                onChange={e => set('systemPrompt', e.target.value)}
                placeholder="You are a helpful assistant..."
                rows={3}
                className="w-full bg-transparent border-b-2 border-glass-border text-text-primary placeholder:text-text-secondary/50 focus:border-text-primary focus:outline-none text-xs font-mono py-1 resize-none transition-colors"
              />
            </Field>
          </>
        );

      case 'http-request':
        return (
          <>
            <Field label="Method">
              <select
                className="w-full bg-transparent border-b-2 border-glass-border text-text-primary text-xs font-mono py-2 focus:outline-none focus:border-text-primary transition-colors"
                value={config.method || 'GET'}
                onChange={e => set('method', e.target.value)}
              >
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="URL">
              <GlassInput
                value={config.url || ''}
                onChange={e => set('url', e.target.value)}
                placeholder="https://api.example.com/data"
              />
            </Field>
            <Field label="Body (JSON)">
              <textarea
                value={typeof config.body === 'string' ? config.body : JSON.stringify(config.body ?? '', null, 2)}
                onChange={e => {
                  try { set('body', JSON.parse(e.target.value)); }
                  catch { set('body', e.target.value); }
                }}
                placeholder="{}"
                rows={4}
                className="w-full bg-transparent border-b-2 border-glass-border text-text-primary placeholder:text-text-secondary/50 focus:border-text-primary focus:outline-none text-xs font-mono py-1 resize-none transition-colors"
              />
            </Field>
          </>
        );

      case 'shell-command':
        return (
          <>
            <Field label="Command">
              <GlassInput
                value={config.command || ''}
                onChange={e => set('command', e.target.value)}
                placeholder="echo 'Hello World'"
                className="font-mono"
              />
            </Field>
            <Field label="Working Directory">
              <GlassInput
                value={config.cwd || ''}
                onChange={e => set('cwd', e.target.value)}
                placeholder="./"
              />
            </Field>
          </>
        );

      case 'file-operation':
        return (
          <>
            <Field label="Operation">
              <select
                className="w-full bg-transparent border-b-2 border-glass-border text-text-primary text-xs font-mono py-2 focus:outline-none focus:border-text-primary transition-colors"
                value={config.operation || 'read'}
                onChange={e => set('operation', e.target.value)}
              >
                <option value="read">Read File</option>
                <option value="write">Write File</option>
                <option value="list">List Directory</option>
              </select>
            </Field>
            <Field label="Path">
              <GlassInput
                value={config.path || ''}
                onChange={e => set('path', e.target.value)}
                placeholder="./data.txt"
              />
            </Field>
            {config.operation === 'write' && (
              <Field label="Content">
                <textarea
                  value={config.content || ''}
                  onChange={e => set('content', e.target.value)}
                  placeholder="File content..."
                  rows={4}
                  className="w-full bg-transparent border-b-2 border-glass-border text-text-primary placeholder:text-text-secondary/50 focus:border-text-primary focus:outline-none text-xs font-mono py-1 resize-none transition-colors"
                />
              </Field>
            )}
          </>
        );

      case 'javascript':
        return (
          <>
            <Field label="Code">
              <div className="text-[9px] font-mono text-text-secondary mb-1">
                Use <code className="bg-black/5 px-1">input</code> to access previous node output. Must <code className="bg-black/5 px-1">return</code> a value.
              </div>
              <textarea
                value={config.code || 'return input;'}
                onChange={e => set('code', e.target.value)}
                rows={8}
                spellCheck={false}
                className="w-full bg-black/5 border border-glass-border text-text-primary focus:border-text-primary focus:outline-none text-[11px] font-mono p-2 resize-y transition-colors leading-relaxed"
              />
            </Field>
          </>
        );

      case 'condition':
        return (
          <>
            <Field label="Condition Expression">
              <div className="text-[9px] font-mono text-text-secondary mb-1">
                JS expression using <code className="bg-black/5 px-1">input</code>. Returns true/false.
              </div>
              <GlassInput
                value={config.expression || ''}
                onChange={e => set('expression', e.target.value)}
                placeholder="input.value > 10"
                className="font-mono"
              />
            </Field>
            <div className="p-2 border border-glass-border/50 bg-black/5 text-[9px] font-mono text-text-secondary space-y-1">
              <div>Examples:</div>
              <div className="text-text-primary">input.length &gt; 0</div>
              <div className="text-text-primary">input.status === "ok"</div>
              <div className="text-text-primary">typeof input === "string"</div>
            </div>
            <div className="flex gap-3 text-[10px] font-mono font-bold mt-1">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                Top handle → TRUE
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                Bottom handle → FALSE
              </span>
            </div>
          </>
        );

      case 'output':
        return (
          <div className="text-[10px] font-mono text-text-secondary space-y-2 p-2 border border-glass-border bg-black/5">
            <p className="font-bold text-text-primary">Output → Chat</p>
            <p>Wstrzykuje wynik poprzedniego węzła do aktywnej sesji chatu jako wiadomość asystenta.</p>
            <p className="text-[9px]">Upewnij się że masz otwartą sesję w zakładce Chat.</p>
          </div>
        );

      default:
        return (
          <div className="text-xs text-text-secondary italic font-mono py-2">
            No configuration available for this node type.
          </div>
        );
    }
  };

  return (
    <GlassCard className="w-80 z-50 p-4 flex flex-col gap-4 bg-bg-app border-2 border-glass-border shadow-[8px_8px_0px_var(--color-shadow-hard)] max-h-[78vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-glass-border pb-2">
        <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-text-primary">
          Node Config
        </h3>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
          <X size={15} />
        </button>
      </div>

      {/* Fields */}
      <div className="space-y-4 flex-1">
        <Field label="Label">
          <GlassInput
            value={label}
            onChange={e => setLabel(e.target.value)}
          />
        </Field>
        {renderConfigFields()}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-glass-border flex gap-2 justify-between">
        {onDuplicate && (
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => onDuplicate(node.id)}
            title="Duplicate this node"
          >
            <Copy size={13} className="mr-1.5" />
            Duplicate
          </GlassButton>
        )}
        <GlassButton size="sm" onClick={handleSave} className="ml-auto">
          <Save size={13} className="mr-1.5" />
          Apply
        </GlassButton>
      </div>
    </GlassCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[9px] font-bold text-text-secondary uppercase tracking-widest font-mono block">
        {label}
      </label>
      {children}
    </div>
  );
}
