import React, { useState, useEffect, useCallback } from 'react';
import { X, Brain, Trash2, FolderSearch, Loader2, BarChart2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassButton } from '@/components/ui/GlassButton';
import { motion, AnimatePresence } from 'motion/react';
import { useSession } from '@/context/SessionContext';
import { useSettings } from '@/context/SettingsContext';

interface KnowledgeBasePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RagEntry { sessionId: string; count: number }
interface RagStats { totalChunks: number; sessions: number }

export function KnowledgeBasePanel({ isOpen, onClose }: KnowledgeBasePanelProps) {
  const { sessions } = useSession();
  const { settings } = useSettings();
  const [stats, setStats] = useState<RagStats | null>(null);
  const [entries, setEntries] = useState<RagEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [indexingAll, setIndexingAll] = useState(false);
  const [clearingId, setClearingId] = useState<string | 'all' | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, listRes] = await Promise.all([
        fetch('/api/rag/status'),
        fetch('/api/rag/list'),
      ]);
      const statusData = await statusRes.json();
      const listData = await listRes.json();
      setStats({ totalChunks: statusData.totalChunks, sessions: statusData.sessions });
      setEntries(listData.entries ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const handleIndexAll = async () => {
    if (sessions.length === 0) return;
    setIndexingAll(true);
    setProgress({ done: 0, total: sessions.length });
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      const msgs = s.messages.map(m => ({ role: m.role, content: m.content || '' }));
      await fetch('/api/rag/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: s.id, messages: msgs, model: settings.ragModel || 'nomic-embed-text' }),
      }).catch(() => {});
      setProgress({ done: i + 1, total: sessions.length });
    }
    setIndexingAll(false);
    setProgress(null);
    load();
  };

  const handleClearSession = async (sessionId: string) => {
    setClearingId(sessionId);
    await fetch('/api/rag/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    setClearingId(null);
    load();
  };

  const handleClearAll = async () => {
    setClearingId('all');
    await fetch('/api/rag/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    setClearingId(null);
    setConfirmClearAll(false);
    load();
  };

  const getSessionTitle = (id: string) =>
    sessions.find(s => s.id === id)?.title ?? id;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-text-primary/20 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-bg-app border-2 border-glass-border shadow-[8px_8px_0px_#1A1A1A] z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-glass-border">
              <h2 className="text-sm font-bold font-mono uppercase tracking-widest text-text-primary flex items-center gap-2">
                <Brain size={15} />
                Knowledge Base
              </h2>
              <button onClick={onClose} className="p-1.5 text-text-secondary hover:text-text-primary border border-transparent hover:border-glass-border transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Stats */}
              {stats && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Chunks', value: stats.totalChunks },
                    { label: 'Sesje', value: stats.sessions },
                    { label: 'Model', value: settings.ragModel || 'nomic-embed-text' },
                  ].map(({ label, value }) => (
                    <div key={label} className="border-2 border-glass-border p-3 text-center shadow-[2px_2px_0px_var(--color-shadow-hard)]">
                      <p className="text-xs font-bold font-mono text-text-primary">{value}</p>
                      <p className="text-[9px] font-mono uppercase tracking-widest text-text-secondary mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* RAG disabled warning */}
              {!settings.ragEnabled && (
                <div className="flex items-start gap-3 border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3">
                  <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-mono text-amber-700 dark:text-amber-300">
                    RAG jest wyłączony. Włącz go w Ustawieniach → Vision/RAG.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold font-mono uppercase tracking-[0.15em] text-text-secondary border-b-2 border-glass-border pb-2">
                  Akcje
                </h3>
                <GlassButton
                  size="sm"
                  onClick={handleIndexAll}
                  disabled={indexingAll || sessions.length === 0}
                  className="w-full flex items-center justify-center gap-2"
                >
                  {indexingAll ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Indeksowanie {progress?.done}/{progress?.total}…
                    </>
                  ) : (
                    <>
                      <BarChart2 size={13} />
                      Indeksuj wszystkie sesje ({sessions.length})
                    </>
                  )}
                </GlassButton>

                {!confirmClearAll ? (
                  <GlassButton
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmClearAll(true)}
                    disabled={!stats || stats.totalChunks === 0}
                    className="w-full flex items-center justify-center gap-2 border-red-300 text-red-500 hover:border-red-500"
                  >
                    <Trash2 size={12} /> Wyczyść cały indeks
                  </GlassButton>
                ) : (
                  <div className="flex gap-2">
                    <GlassButton
                      size="sm"
                      onClick={handleClearAll}
                      disabled={clearingId === 'all'}
                      className="flex-1 border-red-500 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/20"
                    >
                      {clearingId === 'all' ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                      Potwierdź usunięcie
                    </GlassButton>
                    <GlassButton size="sm" variant="ghost" onClick={() => setConfirmClearAll(false)}>
                      Anuluj
                    </GlassButton>
                  </div>
                )}
              </div>

              {/* Indexed sessions */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold font-mono uppercase tracking-[0.15em] text-text-secondary border-b-2 border-glass-border pb-2">
                  Zaindeksowane sesje
                </h3>
                {loading ? (
                  <div className="flex items-center gap-2 text-text-secondary font-mono text-xs py-3">
                    <Loader2 size={12} className="animate-spin" /> Ładowanie…
                  </div>
                ) : entries.length === 0 ? (
                  <div className="border-2 border-dashed border-glass-border p-5 text-center">
                    <FolderSearch size={20} className="mx-auto mb-2 text-text-secondary" />
                    <p className="text-[10px] font-mono text-text-secondary uppercase tracking-widest">Indeks jest pusty</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {entries.map(e => (
                      <div key={e.sessionId} className="flex items-center gap-3 border-2 border-glass-border px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-serif font-medium text-text-primary truncate">{getSessionTitle(e.sessionId)}</p>
                          <p className="text-[9px] font-mono text-text-secondary">{e.count} chunks</p>
                        </div>
                        <button
                          onClick={() => handleClearSession(e.sessionId)}
                          disabled={clearingId === e.sessionId}
                          className="p-1.5 text-text-secondary hover:text-red-500 transition-colors flex-shrink-0"
                          title="Usuń z indeksu"
                        >
                          {clearingId === e.sessionId ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
