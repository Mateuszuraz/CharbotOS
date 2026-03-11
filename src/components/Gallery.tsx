import React, { useState, useCallback } from 'react';
import { Search, Trash2, X, Camera, Download, Archive } from 'lucide-react';
import { getGallery, removeFromGallery, GalleryItem } from '@/lib/gallery';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface GalleryProps {
  onOpenCamera: () => void;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-CA').replace(/-/g, '.') + ' ' + d.toTimeString().slice(0, 5);
  } catch { return iso; }
}

export function Gallery({ onOpenCamera }: GalleryProps) {
  const [items, setItems] = useState<GalleryItem[]>(() => getGallery());
  const [search, setSearch] = useState('');
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = search.trim()
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) ||
        formatDate(i.timestamp).includes(search))
    : items;

  const handleDelete = useCallback((id: string) => {
    setItems(removeFromGallery(id));
    setConfirmDeleteId(null);
    if (lightbox?.id === id) setLightbox(null);
  }, [lightbox]);

  const handleDownload = useCallback((item: GalleryItem) => {
    const a = document.createElement('a');
    a.href = item.dataUrl;
    a.download = item.name;
    a.click();
  }, []);

  // Close lightbox on Escape
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex flex-col h-full bg-bg-app overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b-4 border-glass-border bg-bg-app flex-shrink-0">
        <div className="flex items-center gap-3">
          <Archive size={18} className="text-text-primary" />
          <div>
            <h1 className="text-lg font-bold tracking-tighter uppercase text-text-primary font-mono leading-none">
              Gallery // Archive
            </h1>
            <p className="text-[9px] font-mono text-text-secondary uppercase tracking-widest">
              {items.length} capture{items.length !== 1 ? 's' : ''} stored locally
            </p>
          </div>
        </div>
        {/* Search */}
        <div className="relative w-48">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full pl-7 pr-3 py-1.5 bg-bg-app border-2 border-glass-border text-[10px] font-mono text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-text-primary transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary">
              <X size={10} />
            </button>
          )}
        </div>
      </header>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4 opacity-50">
            <Camera size={40} className="text-text-secondary" />
            <div>
              <p className="text-sm font-bold font-mono uppercase tracking-widest text-text-primary">
                {search ? 'No matches' : 'No captures yet'}
              </p>
              {!search && (
                <p className="text-xs font-mono text-text-secondary mt-1">
                  Use the camera to take photos — they appear here
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 max-w-4xl mx-auto">
            {filtered.map(item => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-2 group"
              >
                {/* Photo */}
                <div
                  className="relative w-full aspect-square bg-center bg-cover cursor-pointer overflow-hidden border-2 border-glass-border shadow-[4px_4px_0px_0px_var(--color-shadow-hard)] hover:shadow-[2px_2px_0px_0px_var(--color-shadow-hard)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  onClick={() => setLightbox(item)}
                  style={{ backgroundImage: `url(${item.dataUrl})` }}
                >
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-text-primary/0 group-hover:bg-text-primary/10 transition-colors" />

                  {/* Action buttons (hover) */}
                  <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); handleDownload(item); }}
                      className="w-7 h-7 bg-bg-app border-2 border-glass-border flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors shadow-[2px_2px_0px_var(--color-shadow-hard)]"
                      title="Download"
                    >
                      <Download size={11} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDeleteId(item.id); }}
                      className="w-7 h-7 bg-bg-app border-2 border-glass-border flex items-center justify-center text-text-secondary hover:text-red-500 transition-colors shadow-[2px_2px_0px_var(--color-shadow-hard)]"
                      title="Delete"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Meta */}
                <div className="bg-bg-app border-2 border-glass-border px-2 py-1.5 shadow-[2px_2px_0px_var(--color-shadow-hard)]">
                  <p className="text-[10px] font-bold font-mono uppercase tracking-wide text-text-primary truncate">
                    {formatDate(item.timestamp)}
                  </p>
                  <p className="text-[9px] font-mono text-text-secondary truncate">{item.name}</p>
                </div>

                {/* Delete confirm */}
                {confirmDeleteId === item.id && (
                  <div className="border-2 border-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1.5">
                    <p className="text-[9px] font-bold font-mono text-red-600 uppercase mb-1">Delete photo?</p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="flex-1 py-1 bg-red-500 text-white text-[9px] font-bold font-mono uppercase border border-red-600"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="flex-1 py-1 text-[9px] font-bold font-mono uppercase border border-glass-border hover:bg-black/5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* FAB — New Capture */}
      <div className="fixed bottom-8 right-8 z-20">
        <div className="relative group">
          <div className="absolute inset-0 bg-text-primary translate-x-[4px] translate-y-[4px] transition-transform group-hover:translate-x-[6px] group-hover:translate-y-[6px]" />
          <button
            onClick={onOpenCamera}
            className="relative flex items-center gap-3 bg-bg-app border-4 border-text-primary px-6 py-4 font-bold font-mono uppercase tracking-widest text-sm text-text-primary transition-transform group-hover:-translate-x-[1px] group-hover:-translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px]"
          >
            <Camera size={20} />
            New Capture
          </button>
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-text-primary/90 flex items-center justify-center p-6"
            onClick={() => setLightbox(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl w-full"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={lightbox.dataUrl}
                alt={lightbox.name}
                className="w-full h-auto max-h-[80vh] object-contain border-4 border-bg-app shadow-[8px_8px_0px_rgba(0,0,0,0.4)]"
              />
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono font-bold text-bg-app uppercase tracking-widest">
                    {formatDate(lightbox.timestamp)}
                  </p>
                  <p className="text-[9px] font-mono text-bg-app/60">{lightbox.name}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload(lightbox)}
                    className="flex items-center gap-1.5 px-3 py-2 border-2 border-bg-app/50 text-bg-app hover:border-bg-app text-[10px] font-mono font-bold uppercase tracking-wider transition-colors"
                  >
                    <Download size={12} />
                    Save
                  </button>
                  <button
                    onClick={() => setLightbox(null)}
                    className="w-9 h-9 border-2 border-bg-app/50 flex items-center justify-center text-bg-app hover:border-bg-app transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
