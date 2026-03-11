import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Mail, Download, Settings2, FileDown, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Message } from '@/types/chat';
import { useLanguage } from '@/context/LanguageContext';

interface ExportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sessionTitle: string;
  messages: Message[];
}

type ExportFormat = 'standard' | 'compact' | 'technical';

function generateMarkdown(sessionTitle: string, messages: Message[], format: ExportFormat): string {
  const timestamp = new Date().toLocaleString();
  const userMsgs = messages.filter(m => m.role !== 'system');

  if (format === 'technical') {
    return JSON.stringify(
      {
        session: sessionTitle,
        exportedAt: new Date().toISOString(),
        messageCount: userMsgs.length,
        messages: userMsgs.map(m => ({ role: m.role, content: m.content })),
      },
      null,
      2,
    );
  }

  if (format === 'compact') {
    let md = `# ${sessionTitle}\n\n`;
    for (const msg of userMsgs) {
      const label = msg.role === 'user' ? 'You' : 'Charbot';
      md += `**${label}:** ${msg.content}\n\n`;
    }
    return md.trim();
  }

  // Standard (default)
  let md = `# ${sessionTitle}\n\n`;
  md += `**Exported:** ${timestamp}  \n`;
  md += `**Messages:** ${userMsgs.length}\n\n---\n\n`;
  for (const msg of userMsgs) {
    const label = msg.role === 'user' ? 'You' : 'Charbot';
    md += `### ${label}\n\n${msg.content}\n\n---\n\n`;
  }
  return md.trim();
}

function triggerMdDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportPanel({ isOpen, onClose, sessionTitle, messages }: ExportPanelProps) {
  const { lang } = useLanguage();
  const [exportFormat, setExportFormat] = useState<ExportFormat>('standard');
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [pdfFilename, setPdfFilename] = useState('');
  const [pdfError, setPdfError] = useState('');

  const safeTitle = sessionTitle.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().slice(0, 40) || 'session';
  const timestamp = new Date().toISOString().slice(0, 10);
  const baseFilename = `${safeTitle}_${timestamp}`;

  const content = generateMarkdown(sessionTitle, messages, exportFormat);
  const previewLines = content.split('\n').slice(0, 6);

  const handlePdfExport = async () => {
    if (pdfStatus === 'loading') return;
    setPdfStatus('loading');
    setPdfError('');
    const filename = `${baseFilename}.pdf`;
    try {
      const res = await fetch('/api/docs/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'PDF generation failed');
      setPdfFilename(data.filename);
      setPdfStatus('done');
      // Trigger download
      const link = document.createElement('a');
      link.href = `/api/docs/download/${encodeURIComponent(data.filename)}`;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e: any) {
      setPdfError(e.message);
      setPdfStatus('error');
    }
  };

  const handleMdExport = () => {
    triggerMdDownload(content, `${baseFilename}.md`);
  };

  const handleEmailExport = () => {
    const subject = encodeURIComponent(`[Charbot OS] ${sessionTitle}`);
    const body = encodeURIComponent(content.slice(0, 2000) + (content.length > 2000 ? '\n\n[...truncated]' : ''));
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const formatLabels: Record<ExportFormat, { label: string; desc: string }> = {
    standard: { label: lang === 'pl' ? 'Standardowy' : 'Standard', desc: lang === 'pl' ? 'Pełna rozmowa z metadanymi' : 'Full conversation with metadata' },
    compact: { label: lang === 'pl' ? 'Kompaktowy' : 'Compact', desc: lang === 'pl' ? 'Tylko wiadomości' : 'Messages only' },
    technical: { label: 'JSON', desc: lang === 'pl' ? 'Format JSON dla deweloperów' : 'JSON format for developers' },
  };

  const msgCount = messages.filter(m => m.role !== 'system').length;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end items-stretch">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-text-primary/20 backdrop-blur-[2px]"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className="relative bg-bg-app border-t-4 border-text-primary shadow-[0_-8px_0_0_rgba(18,18,18,0.08)] z-10 max-h-[90vh] overflow-y-auto"
          >
            {/* Handle */}
            <div className="flex h-8 w-full items-center justify-center border-b border-glass-border">
              <div className="h-1.5 w-16 bg-text-primary opacity-30" />
            </div>

            {/* Header */}
            <div className="px-6 py-4 flex justify-between items-center border-b-2 border-glass-border">
              <div>
                <h4 className="text-[10px] font-black font-mono uppercase tracking-[0.2em] text-text-primary">
                  {lang === 'pl' ? 'Profesjonalny Eksport' : 'Professional Export'}
                </h4>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-bold font-mono bg-text-primary text-bg-app px-2 py-0.5">
                  V1.02_STABLE
                </span>
                <button
                  onClick={onClose}
                  className="text-text-secondary hover:text-text-primary transition-colors border border-transparent hover:border-glass-border p-1"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Paper & Ink Preview */}
              <div className="flex flex-col md:flex-row border-2 border-text-primary shadow-[4px_4px_0px_#1A1A1A] mb-6 bg-bg-app">
                {/* Paper preview */}
                <div
                  className="w-full md:w-2/5 aspect-[3/4] border-b-2 md:border-b-0 md:border-r-2 border-text-primary p-5 flex flex-col overflow-hidden relative"
                  style={{
                    backgroundImage: 'radial-gradient(rgba(0,0,0,0.06) 0.5px, transparent 0.5px)',
                    backgroundSize: '10px 10px',
                  }}
                >
                  {/* Paper header */}
                  <div className="border-b border-text-primary/20 pb-2 mb-3">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-text-secondary font-mono">
                      Document // Charbot OS
                    </p>
                  </div>

                  {/* Preview title */}
                  <h2 className="text-base font-bold tracking-tighter leading-tight mb-3 uppercase text-text-primary font-mono">
                    {sessionTitle.slice(0, 30)}{sessionTitle.length > 30 ? '…' : ''}
                  </h2>

                  {/* Line previews */}
                  <div className="space-y-2 flex-1">
                    {[100, 90, 100, 75, 85, 60].map((w, i) => (
                      <div
                        key={i}
                        className="h-1.5 bg-text-primary/10"
                        style={{ width: `${w}%` }}
                      />
                    ))}
                    {/* Content preview */}
                    <div className="mt-3 space-y-1">
                      {previewLines.slice(0, 4).map((line, i) => (
                        <p key={i} className="text-[7px] font-mono text-text-secondary leading-tight truncate">
                          {line || '\u00A0'}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-3 pt-2 border-t border-text-primary/10 flex justify-between items-end">
                    <div className="w-8 h-8 bg-text-primary" />
                    <p className="text-[7px] font-mono text-text-secondary">
                      {msgCount} {lang === 'pl' ? 'WIAD.' : 'MSG'}
                    </p>
                  </div>
                </div>

                {/* Info panel */}
                <div className="flex flex-col justify-center gap-4 p-5 bg-bg-app flex-1">
                  <div>
                    <p className="text-[9px] font-black font-mono tracking-widest uppercase text-text-secondary mb-0.5">
                      Paper &amp; Ink Aesthetic
                    </p>
                    <p className="text-lg font-bold leading-tight tracking-tighter uppercase text-text-primary">
                      {lang === 'pl' ? 'Podgląd' : 'Print Preview'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="text-text-primary" />
                      <p className="text-xs font-mono text-text-primary italic">{baseFilename}.pdf</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-text-secondary">
                        {new Date().toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-US')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-text-secondary">
                        {msgCount} {lang === 'pl' ? 'wiadomości' : 'messages'}
                      </span>
                    </div>
                  </div>

                  {/* Format selector */}
                  <div className="relative">
                    <button
                      onClick={() => setShowFormatMenu(v => !v)}
                      className="w-full bg-text-primary text-bg-app font-bold py-2.5 px-4 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest hover:translate-x-[1px] transition-transform"
                    >
                      <span className="flex items-center gap-2">
                        <Settings2 size={12} />
                        {lang === 'pl' ? 'Format' : 'Format'}: {formatLabels[exportFormat].label}
                      </span>
                      <span className="text-bg-app/60">▾</span>
                    </button>
                    {showFormatMenu && (
                      <div className="absolute top-full left-0 right-0 z-10 border-2 border-text-primary bg-bg-app shadow-[4px_4px_0px_#1A1A1A] mt-0.5">
                        {(Object.entries(formatLabels) as [ExportFormat, { label: string; desc: string }][]).map(([fmt, info]) => (
                          <button
                            key={fmt}
                            onClick={() => { setExportFormat(fmt); setShowFormatMenu(false); }}
                            className={cn(
                              'w-full text-left px-4 py-2.5 border-b border-glass-border last:border-b-0 transition-colors',
                              exportFormat === fmt
                                ? 'bg-text-primary text-bg-app'
                                : 'text-text-primary hover:bg-black/5',
                            )}
                          >
                            <p className="text-[10px] font-bold font-mono uppercase tracking-wider">{info.label}</p>
                            <p className={cn(
                              'text-[8px] font-mono mt-0.5',
                              exportFormat === fmt ? 'text-bg-app/60' : 'text-text-secondary',
                            )}>{info.desc}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Export Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                {/* PDF */}
                <button
                  onClick={handlePdfExport}
                  disabled={pdfStatus === 'loading' || messages.length === 0}
                  className={cn(
                    'group flex items-center gap-4 border-2 border-text-primary p-4 transition-all shadow-[4px_4px_0px_#1A1A1A] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#1A1A1A]',
                    'active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
                    pdfStatus === 'done'
                      ? 'bg-green-50 border-green-600'
                      : pdfStatus === 'error'
                        ? 'bg-red-50 border-red-500'
                        : 'bg-bg-app hover:bg-text-primary hover:text-bg-app',
                    pdfStatus === 'loading' && 'opacity-60 cursor-wait',
                  )}
                >
                  <div className={cn(
                    'flex items-center justify-center border-2 shrink-0 w-11 h-11 transition-colors',
                    pdfStatus === 'done' ? 'border-green-600 text-green-600' :
                    pdfStatus === 'error' ? 'border-red-500 text-red-500' :
                    'border-text-primary group-hover:border-bg-app text-text-primary group-hover:text-bg-app',
                  )}>
                    {pdfStatus === 'loading' ? <Loader2 size={22} className="animate-spin" /> :
                     pdfStatus === 'done' ? <CheckCircle size={22} /> :
                     <Download size={22} />}
                  </div>
                  <div className="text-left">
                    <p className="text-[8px] font-black font-mono tracking-widest uppercase opacity-60">
                      {lang === 'pl' ? 'Profesjonalny' : 'Professional'}
                    </p>
                    <p className="text-xs font-bold font-mono uppercase">
                      {pdfStatus === 'loading' ? (lang === 'pl' ? 'Generuję…' : 'Generating…') :
                       pdfStatus === 'done' ? (lang === 'pl' ? 'Gotowe!' : 'Done!') :
                       pdfStatus === 'error' ? 'Error' :
                       'EXPORT AS PDF'}
                    </p>
                    {pdfStatus === 'error' && (
                      <p className="text-[8px] font-mono text-red-500 mt-0.5 truncate max-w-[120px]">{pdfError}</p>
                    )}
                  </div>
                </button>

                {/* Markdown */}
                <button
                  onClick={handleMdExport}
                  disabled={messages.length === 0}
                  className="group flex items-center gap-4 bg-bg-app border-2 border-text-primary p-4 hover:bg-text-primary hover:text-bg-app transition-all shadow-[4px_4px_0px_#1A1A1A] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <div className="flex items-center justify-center border-2 border-text-primary group-hover:border-bg-app text-text-primary group-hover:text-bg-app shrink-0 w-11 h-11 transition-colors">
                    <FileDown size={22} />
                  </div>
                  <div className="text-left">
                    <p className="text-[8px] font-black font-mono tracking-widest uppercase opacity-60">
                      {lang === 'pl' ? 'Deweloper' : 'Developer'}
                    </p>
                    <p className="text-xs font-bold font-mono uppercase">EXPORT AS MD</p>
                  </div>
                </button>

                {/* Email */}
                <button
                  onClick={handleEmailExport}
                  disabled={messages.length === 0}
                  className="group flex items-center gap-4 bg-bg-app border-2 border-text-primary p-4 hover:bg-text-primary hover:text-bg-app transition-all shadow-[4px_4px_0px_#1A1A1A] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#1A1A1A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <div className="flex items-center justify-center border-2 border-text-primary group-hover:border-bg-app text-text-primary group-hover:text-bg-app shrink-0 w-11 h-11 transition-colors">
                    <Mail size={22} />
                  </div>
                  <div className="text-left">
                    <p className="text-[8px] font-black font-mono tracking-widest uppercase opacity-60">
                      {lang === 'pl' ? 'Bezpośredni' : 'Direct'}
                    </p>
                    <p className="text-xs font-bold font-mono uppercase">
                      {lang === 'pl' ? 'WYŚLIJ EMAIL' : 'SHARE TO EMAIL'}
                    </p>
                  </div>
                </button>
              </div>

              {/* Cancel */}
              <button
                onClick={onClose}
                className="w-full border-2 border-glass-border py-3.5 text-[10px] font-black font-mono tracking-[0.3em] uppercase text-text-secondary hover:bg-red-50 hover:border-red-500 hover:text-red-500 transition-all"
              >
                {lang === 'pl' ? 'Anuluj Eksport' : 'Cancel Export'}
              </button>
            </div>

            {/* Safe area */}
            <div className="h-6 bg-bg-app" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
