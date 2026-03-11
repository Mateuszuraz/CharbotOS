import React, { useState } from 'react';
import { FileText, FileJson, FileCode, File, Download, Save, Copy, Check, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassButton } from '@/components/ui/GlassButton';

const PREVIEW_LINES = 10;

const FORMAT_BADGE: Record<string, string> = {
  txt:  'bg-gray-100 text-gray-700 border-gray-400',
  md:   'bg-blue-50 text-blue-700 border-blue-400',
  html: 'bg-orange-50 text-orange-700 border-orange-400',
  json: 'bg-yellow-50 text-yellow-700 border-yellow-400',
  csv:  'bg-green-50 text-green-700 border-green-400',
  pdf:  'bg-red-50 text-red-700 border-red-400',
};

const FORMAT_ICON: Record<string, React.ElementType> = {
  json: FileJson,
  html: FileCode,
  md:   FileCode,
};

function getIcon(ext: string): React.ElementType {
  return FORMAT_ICON[ext] ?? FileText;
}

export interface ArtifactCardProps {
  format: string;
  filename: string;
  content: string;
}

export function ArtifactCard({ format, filename, content }: ArtifactCardProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Icon = getIcon(format);
  const badge = FORMAT_BADGE[format] ?? FORMAT_BADGE.txt;

  const allLines = content.split('\n');
  const preview = allLines.slice(0, PREVIEW_LINES).join('\n');
  const overflow = allLines.length - PREVIEW_LINES;

  const doSave = async (): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/docs/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => doSave();

  const handleDownload = async () => {
    if (format === 'pdf') {
      // PDF must be generated server-side
      const ok = await doSave();
      if (ok) window.open(`/api/docs/download/${encodeURIComponent(filename)}`, '_blank');
      return;
    }
    // Client-side download for text formats
    const mime =
      format === 'json' ? 'application/json' :
      format === 'html' ? 'text/html' :
      format === 'csv'  ? 'text/csv' :
      'text/plain';
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="my-2 border-2 border-glass-border shadow-[4px_4px_0px_var(--color-shadow-hard)] font-mono text-left not-prose">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b-2 border-glass-border bg-black/5">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={13} className="text-text-primary flex-shrink-0" />
          <span className="text-[11px] font-bold text-text-primary truncate">{filename}</span>
          <span className={cn('text-[8px] font-black uppercase px-1.5 py-0.5 border flex-shrink-0', badge)}>
            {format.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Copy */}
          <button
            onClick={handleCopy}
            title="Copy content"
            className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
          >
            {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
          </button>
          {/* Download */}
          <button
            onClick={handleDownload}
            title={format === 'pdf' ? 'Generate & Download PDF' : 'Download file'}
            className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
          >
            <Download size={12} />
          </button>
          {/* Save to Vault */}
          <GlassButton
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'text-[10px] px-2 h-6',
              saved && 'border-green-500 text-green-700',
            )}
          >
            {saving ? (
              <Loader2 size={10} className="animate-spin mr-1" />
            ) : saved ? (
              <Check size={10} className="mr-1" />
            ) : (
              <Save size={10} className="mr-1" />
            )}
            {saved ? 'Saved!' : 'Save'}
          </GlassButton>
        </div>
      </div>

      {/* ── Content preview ── */}
      <pre className="px-3 py-2.5 text-[10px] leading-relaxed text-text-primary bg-bg-app overflow-x-auto max-h-[220px] overflow-y-auto whitespace-pre-wrap break-words">
        {preview}
        {overflow > 0 && (
          <span className="text-text-secondary italic">
            {'\n'}… and {overflow} more line{overflow !== 1 ? 's' : ''}
          </span>
        )}
      </pre>

      {/* ── Error bar ── */}
      {error && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-red-600 bg-red-50 border-t border-red-300">
          <AlertCircle size={10} />
          {error}
        </div>
      )}

      {/* ── Save path hint ── */}
      {saved && (
        <div className="px-3 py-1 text-[9px] font-mono text-green-700 bg-green-50 border-t border-green-300">
          Saved to ~/CharbotVault/documents/{filename}
        </div>
      )}
    </div>
  );
}
