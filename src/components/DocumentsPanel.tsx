import React, { useEffect, useState, useCallback } from 'react';
import { X, FolderOpen, Download, Trash2, FileText, FileJson, FileCode, File, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { GlassButton } from '@/components/ui/GlassButton';
import { useLanguage } from '@/context/LanguageContext';

interface DocEntry {
  name: string;
  ext: string;
  size: number;
  modifiedAt: string;
}

const EXT_ICON: Record<string, React.ElementType> = {
  json: FileJson,
  html: FileCode,
  md: FileCode,
  pdf: FileText,
};

const EXT_BADGE: Record<string, string> = {
  txt:  'bg-gray-100 text-gray-600 border-gray-300',
  md:   'bg-blue-50 text-blue-600 border-blue-300',
  html: 'bg-orange-50 text-orange-600 border-orange-300',
  json: 'bg-yellow-50 text-yellow-700 border-yellow-300',
  csv:  'bg-green-50 text-green-700 border-green-300',
  pdf:  'bg-red-50 text-red-700 border-red-300',
};

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface DocumentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentsPanel({ isOpen, onClose }: DocumentsPanelProps) {
  const { t, lang } = useLanguage();
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/docs');
      setDocs(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) loadDocs();
  }, [isOpen, loadDocs]);

  const handleDelete = async (name: string) => {
    setDeleting(name);
    try {
      await fetch(`/api/docs/${encodeURIComponent(name)}`, { method: 'DELETE' });
      setDocs(prev => prev.filter(d => d.name !== name));
    } catch { /* ignore */ } finally {
      setDeleting(null);
    }
  };

  const handleDownload = (name: string) => {
    window.open(`/api/docs/download/${encodeURIComponent(name)}`, '_blank');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-text-primary/20 backdrop-blur-[2px]"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-80 bg-bg-app border-l-2 border-glass-border shadow-[-8px_0_24px_rgba(0,0,0,0.1)] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-glass-border">
              <div className="flex items-center gap-2">
                <FolderOpen size={15} className="text-text-primary" />
                <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-text-primary">
                  {t.vaultDocuments}
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={loadDocs}
                  className={cn('p-1.5 text-text-secondary hover:text-text-primary transition-colors', loading && 'animate-spin')}
                  title="Refresh"
                >
                  <RefreshCw size={13} />
                </button>
                <button onClick={onClose} className="p-1.5 text-text-secondary hover:text-text-primary transition-colors">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Hint */}
            <div className="px-4 py-2 bg-black/5 border-b border-glass-border">
              <p className="text-[9px] font-mono text-text-secondary leading-relaxed">
                {t.askAiDocHint}{' '}
                <code className="bg-black/10 px-1">```pdf:report.pdf</code>
                {' '}{lang === 'pl' ? 'lub' : 'or'}{' '}
                <code className="bg-black/10 px-1">```md:notes.md</code>
              </p>
            </div>

            {/* Document list */}
            <div className="flex-1 overflow-y-auto">
              {loading && docs.length === 0 && (
                <div className="flex items-center justify-center h-32 text-text-secondary text-xs font-mono">
                  Loading…
                </div>
              )}

              {!loading && docs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-6">
                  <FolderOpen size={32} className="text-text-secondary/30" />
                  <p className="text-xs font-mono text-text-secondary">
                    No documents yet.
                    <br />Ask the AI to create one!
                  </p>
                </div>
              )}

              <div className="divide-y divide-glass-border">
                {docs.map(doc => {
                  const Icon = EXT_ICON[doc.ext] ?? File;
                  const badge = EXT_BADGE[doc.ext] ?? EXT_BADGE.txt;
                  return (
                    <div key={doc.name} className="flex items-center gap-2 px-4 py-3 hover:bg-black/5 group transition-colors">
                      <Icon size={18} className="text-text-secondary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold font-mono text-text-primary truncate">{doc.name}</span>
                          <span className={cn('text-[7px] font-black uppercase px-1 py-0.5 border flex-shrink-0', badge)}>
                            {doc.ext}
                          </span>
                        </div>
                        <div className="text-[9px] font-mono text-text-secondary mt-0.5">
                          {formatBytes(doc.size)} · {relTime(doc.modifiedAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDownload(doc.name)}
                          className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
                          title="Download"
                        >
                          <Download size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.name)}
                          disabled={deleting === doc.name}
                          className="p-1.5 text-text-secondary hover:text-red-500 transition-colors disabled:opacity-40"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-glass-border">
              <p className="text-[9px] font-mono text-text-secondary">
                {t.savedTo}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
