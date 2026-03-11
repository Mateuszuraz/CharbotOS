import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, RefreshCw, Loader2, AlertCircle, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  models: string[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  placeholder?: string;
}

export function ModelSelector({
  value,
  onChange,
  models,
  loading,
  error,
  onRefresh,
  placeholder = 'Select or type a model...',
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filtered = models.filter(m =>
    m.toLowerCase().includes(filter.toLowerCase())
  );

  const handleOpen = () => {
    setOpen(v => !v);
    setFilter('');
  };

  const handleSelect = (model: string) => {
    onChange(model);
    setOpen(false);
    setFilter('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const target = filter || value;
      if (target) handleSelect(target);
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setFilter('');
    }
    if (e.key === 'ArrowDown' && filtered.length > 0) {
      // simple focus first item
      (containerRef.current?.querySelector('[data-model-item]') as HTMLElement)?.focus();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-2 items-end">
        {/* Trigger */}
        <button
          type="button"
          onClick={handleOpen}
          className={cn(
            'glass-input flex-1 flex items-center justify-between gap-2 text-sm text-left',
            'py-3 cursor-pointer',
            open && 'border-accent-primary'
          )}
        >
          <span className={cn('truncate font-mono', !value && 'text-text-secondary/50')}>
            {value || placeholder}
          </span>
          {loading ? (
            <Loader2 size={13} className="shrink-0 animate-spin text-text-secondary" />
          ) : (
            <ChevronDown
              size={13}
              className={cn('shrink-0 text-text-secondary transition-transform duration-200', open && 'rotate-180')}
            />
          )}
        </button>

        {/* Refresh button */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRefresh(); }}
          disabled={loading}
          title="Odśwież listę modeli"
          className="pb-0.5 text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors"
        >
          <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      {/* Status indicators below trigger */}
      {error && !open && (
        <p className="flex items-center gap-1 mt-1 text-xs font-mono text-red-500">
          <AlertCircle size={11} /> {error}
        </p>
      )}
      {!loading && !error && models.length > 0 && !open && (
        <p className="flex items-center gap-1 mt-1 text-xs font-mono text-text-secondary/60">
          <CheckCheck size={11} /> {models.length} model{models.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 line-art-card rounded-lg overflow-hidden">
          {/* Filter input */}
          <div className="px-3 pt-3 pb-2 border-b-2 border-glass-border">
            <input
              ref={inputRef}
              className="w-full bg-transparent text-sm font-mono text-text-primary outline-none placeholder:text-text-secondary/40"
              placeholder="Filter or type custom model..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto">
            {loading && (
              <div className="flex items-center gap-2 px-4 py-3 text-text-secondary text-xs font-mono">
                <Loader2 size={12} className="animate-spin" />
                Detecting models...
              </div>
            )}

            {error && !loading && (
              <div className="px-4 py-3 text-red-500 text-xs font-mono">
                <p className="flex items-center gap-1.5 mb-1">
                  <AlertCircle size={12} /> {error}
                </p>
                <button
                  type="button"
                  onClick={onRefresh}
                  className="underline hover:no-underline"
                >
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && filtered.length === 0 && (
              <div className="px-4 py-3 text-text-secondary/60 text-xs font-mono">
                {models.length === 0
                  ? 'No models detected. Check your connection/key.'
                  : 'No matches found.'}
              </div>
            )}

            {filtered.map(model => (
              <button
                key={model}
                type="button"
                data-model-item
                onClick={() => handleSelect(model)}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-sm font-mono transition-colors',
                  'hover:bg-text-primary/8 focus:bg-text-primary/8 focus:outline-none',
                  value === model && 'bg-text-primary/10 font-bold'
                )}
              >
                {model}
              </button>
            ))}

            {/* Use custom model option */}
            {filter && !filtered.includes(filter) && (
              <button
                type="button"
                onClick={() => handleSelect(filter)}
                className="w-full text-left px-4 py-2.5 text-xs font-mono text-text-secondary hover:bg-text-primary/8 border-t-2 border-glass-border transition-colors"
              >
                Use &ldquo;{filter}&rdquo; (custom)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
