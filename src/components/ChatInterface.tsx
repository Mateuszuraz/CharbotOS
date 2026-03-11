import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useLocalChat, Message, Attachment } from '@/hooks/useLocalChat';
import { useSession } from '@/context/SessionContext';
import { useSettings } from '@/context/SettingsContext';
import { addToGallery } from '@/lib/gallery';
import { GlassButton } from '@/components/ui/GlassButton';
import {
  Settings, Send, StopCircle, Trash2, User, Sparkles,
  PlusCircle, Key, Paperclip, X, FileText, ImageIcon, Upload,
  Camera, RefreshCw, ChevronDown, ZoomIn, ScanText, Loader2, Check, MessageCircle, FolderOpen, FileOutput, Brain, Copy,
} from 'lucide-react';
import { CharbotAvatar } from '@/components/ui/CharbotAvatar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { ArtifactCard } from '@/components/ArtifactCard';
import { useChatContextMenu } from '@/components/ChatContextMenu';
import { DocumentsPanel } from '@/components/DocumentsPanel';
import { KnowledgeBasePanel } from '@/components/KnowledgeBasePanel';
import { ToolCallBubble } from '@/components/ToolCallBubble';
import { ExportPanel } from '@/components/ExportPanel';
import { TutorialTooltip } from '@/components/ui/TutorialTooltip';
import { useLanguage } from '@/context/LanguageContext';

// Text file detection by extension (MIME types are unreliable cross-browser)
const TEXT_EXTS = ['.txt', '.md', '.json', '.csv', '.html', '.css', '.js', '.ts', '.tsx', '.jsx', '.xml', '.py', '.sh', '.yaml', '.yml', '.toml', '.ini', '.env', '.sql', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.rb', '.php', '.swift', '.kt'];
function isTextFile(file: File): boolean {
  return (
    file.type.startsWith('text/') ||
    file.type === 'application/json' ||
    file.type === 'application/javascript' ||
    file.type === 'application/typescript' ||
    file.type === 'application/xml' ||
    TEXT_EXTS.some(ext => file.name.toLowerCase().endsWith(ext))
  );
}

const ACCEPTED_EXT = '.jpg,.jpeg,.png,.gif,.webp,.txt,.md,.pdf,.json,.csv,.html,.css,.js,.ts,.tsx,.jsx,.xml,.py,.sh,.yaml,.yml';

const VISION_PRESETS = [
  {
    id: 'ocr',
    label: 'Read text (OCR)',
    prompt: 'Read and transcribe ALL visible text exactly as it appears, preserving line breaks and formatting. Mark uncertain text with [??].',
  },
  {
    id: 'describe',
    label: 'Describe image',
    prompt: 'Describe what you see in this image in 3–5 sentences. Include the main subject, setting, colors, and any notable details.',
  },
  {
    id: 'json',
    label: 'Extract fields (JSON)',
    prompt: 'Extract all structured data fields from this image (labels, dates, codes, quantities, prices, names, etc.) and return them as a compact JSON object.',
  },
] as const;

interface ChatInterfaceProps {
  onOpenSettings: () => void;
  autoOpenCamera?: boolean;
  onCameraAutoOpened?: () => void;
}

export function ChatInterface({ onOpenSettings, autoOpenCamera, onCameraAutoOpened }: ChatInterfaceProps) {
  const {
    messages, input, setInput, isLoading, error,
    handleSubmit, stop, clearChat, addVisionResult, deleteMessage,
    pendingAttachments, addAttachment, removeAttachment,
  } = useLocalChat();
  const { settings } = useSettings();
  const { activeSession, createSession } = useSession();
  const { t, lang } = useLanguage();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileProcessing, setFileProcessing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [visionPresetFor, setVisionPresetFor] = useState<string | null>(null); // att.id
  const [telegramSending, setTelegramSending] = useState(false);
  const [telegramSent, setTelegramSent] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showKB, setShowKB] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-open camera when triggered from Gallery
  useEffect(() => {
    if (autoOpenCamera) {
      setShowCamera(true);
      onCameraAutoOpened?.();
    }
  }, [autoOpenCamera, onCameraAutoOpened]);

  // --- Vision analysis ---
  const handleAnalyzeImage = useCallback(async (att: Attachment, prompt: string) => {
    setVisionPresetFor(null);
    setAnalyzingId(att.id);
    // Inject user message so the exchange appears in chat
    const msgId = Date.now().toString();
    const asstId = (Date.now() + 1).toString();
    const userMsg: Message = {
      id: msgId, role: 'user', content: `Analyze image: **${att.name}**`, attachments: [att],
    };
    const asstMsg: Message = { id: asstId, role: 'assistant', content: '' };
    // We reach into setMessages via the addAttachment closure — instead, call handleSubmit pattern
    // For vision we bypass the normal AI provider and call /api/vision/analyze directly
    try {
      const res = await fetch('/api/vision/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: att.base64, mime: att.mimeType, prompt, model: settings.visionModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Vision analysis failed');
      // Inject as chat messages via setInput trick — use the exposed setMessages workaround
      // We'll inject directly via addToChat helper exposed by useLocalChat
      addVisionResult(userMsg, asstId, data.response);
    } catch (err: any) {
      addVisionResult(userMsg, asstId, `[Vision Error] ${err.message}`);
    } finally {
      setAnalyzingId(null);
    }
  }, []);

  // --- Send session to Telegram ---
  const handleSendToTelegram = useCallback(async () => {
    if (!activeSession || messages.length === 0 || telegramSending) return;
    setTelegramSending(true);
    setTelegramSent(false);
    const lines = messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`);
    const transcript =
      `# ${activeSession.title}\nExported: ${new Date().toLocaleString()}\nMessages: ${messages.length}\n\n` +
      lines.join('\n\n---\n\n');
    try {
      const res = await fetch('/api/telegram/send-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: activeSession.title, transcript }),
      });
      if (res.ok) {
        setTelegramSent(true);
        setTimeout(() => setTelegramSent(false), 3000);
      }
    } catch { /* ignore */ } finally {
      setTelegramSending(false);
    }
  }, [activeSession, messages, telegramSending]);

  // --- File handling ---

  const processFile = useCallback(async (file: File) => {
    setFileProcessing(true);
    try {
      // Read as data URL (gives base64 + preview)
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = e => resolve(e.target?.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const base64 = dataUrl.split(',')[1] ?? '';
      const attachment: Attachment = {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl,
        base64,
      };

      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        // PDF: extract text with pdfjs-dist (dynamic import to keep bundle lean)
        try {
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.min.mjs',
            import.meta.url,
          ).href;
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let text = `[PDF: ${file.name} — ${pdf.numPages} page${pdf.numPages !== 1 ? 's' : ''}]\n\n`;
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items
              .map((item: any) => ('str' in item ? item.str : ''))
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (pageText) text += `--- Page ${i} ---\n${pageText}\n\n`;
          }
          addAttachment({ ...attachment, text: text.trim() });
        } catch {
          addAttachment(attachment); // fallback: send as binary
        }
      } else if (isTextFile(file)) {
        const text = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = e => resolve(e.target?.result as string);
          r.onerror = reject;
          r.readAsText(file);
        });
        addAttachment({ ...attachment, text });
      } else {
        addAttachment(attachment);
      }
    } catch {
      // silently ignore read errors
    } finally {
      setFileProcessing(false);
    }
  }, [addAttachment]);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(processFile);
  }, [processFile]);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragOver(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const LoadingDots = () => (
    <div className="flex gap-1 items-center h-6 px-1">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 bg-text-primary rounded-full"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
        />
      ))}
    </div>
  );

  // Welcome / Idle screen — shown when no active session
  if (!activeSession) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center gap-6 max-w-sm w-full"
        >
          {/* Avatar */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-text-primary translate-y-2 translate-x-2" />
            <div className="relative w-32 h-32 rounded-full border-4 border-glass-border overflow-hidden bg-bg-app shadow-xl">
              <CharbotAvatar emotion="happy" />
            </div>
            <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-text-primary rounded-full shadow-[2px_2px_0px_var(--color-shadow-hard)]" />
          </div>

          {/* Title */}
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tighter uppercase text-text-primary leading-none">
              Charbot OS:<br />
              <span className="text-text-secondary">{t.idle}</span>
            </h1>
            <p className="text-xs font-mono text-text-secondary uppercase tracking-widest">{t.systemReady} · v2.4.0</p>
          </div>

          {/* Actions */}
          <div className="w-full flex flex-col gap-3 mt-2">
            <div className="relative group">
              <div className="absolute inset-0 bg-text-primary/20 translate-y-2" />
              <button
                onClick={() => createSession()}
                className="relative w-full flex items-center justify-center gap-2 h-14 bg-text-primary text-bg-app text-sm font-bold uppercase tracking-wide border-2 border-text-primary shadow-[4px_4px_0px_rgba(0,0,0,0.2)] transition-transform group-hover:-translate-y-0.5 group-active:translate-y-0.5"
              >
                <PlusCircle size={18} />
                {t.startNewSession}
              </button>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-text-primary translate-y-1 translate-x-1 transition-transform group-hover:translate-y-1.5 group-hover:translate-x-1.5" />
              <button
                onClick={onOpenSettings}
                className="relative w-full flex items-center justify-center gap-2 h-12 bg-bg-app text-text-primary text-sm font-bold uppercase tracking-wide border-2 border-glass-border transition-transform group-hover:-translate-y-0.5 group-hover:-translate-x-0.5 group-active:translate-y-0"
              >
                <Key size={16} />
                {t.configureApiKeys}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full relative overflow-hidden"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-4 border-b-2 border-glass-border bg-bg-app/90 backdrop-blur-md z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border-2 border-glass-border rounded-full overflow-hidden">
            <CharbotAvatar emotion={isLoading ? 'thinking' : 'happy'} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-text-primary font-mono uppercase truncate max-w-[200px]">
                {activeSession.title}
              </h1>
              {settings.personaEnabled && settings.personaName && (
                <span className="text-[8px] font-bold font-mono px-2 py-0.5 border border-text-primary/40 text-text-secondary flex-shrink-0">
                  {settings.personaName}
                </span>
              )}
            </div>
            <p className="text-[10px] text-text-secondary font-mono uppercase tracking-widest">
              {isLoading ? t.thinking : t.neuralInterfaceActive}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <GlassButton
            variant="ghost"
            size="icon"
            onClick={() => setShowKB(true)}
            title="Knowledge Base"
          >
            <Brain size={16} />
          </GlassButton>
          <TutorialTooltip tutorialKey="chat_documents" position="bottom">
            <GlassButton
              variant="ghost"
              size="icon"
              onClick={() => setShowDocs(true)}
              title={t.documents}
            >
              <FolderOpen size={16} />
            </GlassButton>
          </TutorialTooltip>
          <TutorialTooltip tutorialKey="chat_export" position="bottom">
            <GlassButton
              variant="ghost"
              size="icon"
              onClick={() => setShowExport(true)}
              disabled={messages.length === 0}
              title={lang === 'pl' ? 'Eksportuj sesję' : 'Export session'}
            >
              <FileOutput size={16} />
            </GlassButton>
          </TutorialTooltip>
          <TutorialTooltip tutorialKey="chat_telegram" position="bottom">
            <GlassButton
              variant="ghost"
              size="icon"
              onClick={handleSendToTelegram}
              disabled={messages.length === 0 || telegramSending}
              title={t.sendToTelegram}
              className={cn(telegramSent && 'text-green-600 border-green-500')}
            >
              {telegramSending
                ? <Loader2 size={16} className="animate-spin" />
                : telegramSent
                  ? <Check size={16} />
                  : <MessageCircle size={16} />
              }
            </GlassButton>
          </TutorialTooltip>
          <TutorialTooltip tutorialKey="chat_clear" position="bottom">
            <GlassButton variant="ghost" size="icon" onClick={clearChat} title={t.clearChat}>
              <Trash2 size={16} />
            </GlassButton>
          </TutorialTooltip>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full flex flex-col items-center justify-center text-center opacity-50"
          >
            <Sparkles size={28} className="text-text-primary mb-3" />
            <p className="text-lg font-serif font-medium text-text-primary">{t.howCanIHelp}</p>
            <p className="text-xs text-text-secondary font-mono mt-1 max-w-xs">
              {t.typeOrDropFiles}
            </p>
          </motion.div>
        )}

        <AnimatePresence initial={false} mode="popLayout">
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              t={t}
              onDelete={() => deleteMessage(msg.id)}
              onReply={() => setInput(`> ${msg.content.slice(0, 120).replace(/\n/g, ' ')}\n\n`)}
            />
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-4 max-w-3xl"
          >
            <div className="w-10 h-10 rounded-lg bg-bg-app border-2 border-glass-border flex-shrink-0 flex items-center justify-center overflow-hidden">
              <CharbotAvatar emotion="thinking" />
            </div>
            <div className="bg-bg-app border-2 border-glass-border p-4 shadow-[4px_4px_0px_var(--color-shadow-hard)] ink-bubble-bot flex items-center">
              <LoadingDots />
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl p-4 border-2 border-red-500 bg-red-50 text-red-600 font-mono text-xs flex items-center gap-3 shadow-[4px_4px_0px_#EF4444]"
          >
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            SYSTEM ERROR: {error}
          </motion.div>
        )}

        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Pending Attachments tray */}
      <AnimatePresence>
        {pendingAttachments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t-2 border-glass-border overflow-hidden"
          >
            <div className="px-4 py-2 flex gap-2 flex-wrap bg-bg-app">
              <span className="text-[9px] font-bold font-mono uppercase text-text-secondary tracking-widest self-center">
                Attachments:
              </span>
              {pendingAttachments.map(att => (
                <AttachmentChip
                  key={att.id}
                  att={att}
                  onRemove={removeAttachment}
                  onAnalyze={att.mimeType.startsWith('image/') ? handleAnalyzeImage : undefined}
                  isAnalyzing={analyzingId === att.id}
                  showPresets={visionPresetFor === att.id}
                  onTogglePresets={() => setVisionPresetFor(prev => prev === att.id ? null : att.id)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="p-4 md:p-5 border-t-2 border-glass-border bg-bg-app/90 backdrop-blur-md z-10">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2 bg-bg-app border-2 border-glass-border p-2 shadow-[4px_4px_0px_var(--color-shadow-hard)]">
            {/* File attachment button */}
            <TutorialTooltip tutorialKey="chat_attach" position="top">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 p-2 text-text-secondary hover:text-text-primary transition-colors self-end mb-0.5"
                title="Attach files (images, text, PDF)"
              >
                <Paperclip size={17} />
              </button>
            </TutorialTooltip>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXT}
              multiple
              className="hidden"
              onChange={e => handleFileSelect(e.target.files)}
            />

            {/* Camera capture button */}
            <TutorialTooltip tutorialKey="chat_camera" position="top">
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="flex-shrink-0 p-2 text-text-secondary hover:text-text-primary transition-colors self-end mb-0.5"
                title="Take a photo (webcam / GoPro / external camera)"
              >
                <Camera size={17} />
              </button>
            </TutorialTooltip>

            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={pendingAttachments.length > 0 ? t.addMessageOrSend : t.typeMessage}
              disabled={isLoading}
              rows={1}
              className="flex-1 bg-transparent border-none focus:ring-0 min-h-[44px] max-h-[160px] py-3 font-serif text-base text-text-primary placeholder:text-text-secondary/50 resize-none outline-none"
              style={{ fieldSizing: 'content' } as any}
              autoFocus
            />

            <div className="flex-shrink-0 pb-1 pr-1">
              {isLoading ? (
                <GlassButton
                  type="button"
                  onClick={stop}
                  variant="secondary"
                  size="icon"
                  className="w-10 h-10 bg-red-100 text-red-500 border-red-500 hover:bg-red-200"
                >
                  <StopCircle size={16} />
                </GlassButton>
              ) : (
                <GlassButton
                  type="submit"
                  disabled={fileProcessing || (!input.trim() && pendingAttachments.length === 0)}
                  variant="primary"
                  size="icon"
                  className="w-10 h-10"
                  title={fileProcessing ? 'Reading file…' : 'Send'}
                >
                  <Send size={16} />
                </GlassButton>
              )}
            </div>
          </div>

          <div className="flex justify-between text-[9px] font-mono text-text-secondary/40 mt-1.5 px-1">
            <span>{t.dragDropHint}</span>
            <span>{t.enterToSend}</span>
          </div>
        </form>
      </div>

      {/* Drag & Drop overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center p-8 bg-bg-app/85 backdrop-blur-[2px]"
          >
            <div className="w-full h-full border-4 border-dashed border-glass-border flex flex-col items-center justify-center gap-4 text-center">
              <div className="p-4 border-2 border-glass-border bg-bg-app shadow-[4px_4px_0px_var(--color-shadow-hard)]">
                <Upload size={40} className="text-text-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-bold uppercase tracking-tighter text-text-primary leading-none">
                  {t.dropFilesToAnalyze}
                </h3>
                <p className="text-xs font-mono text-text-secondary mt-2 uppercase tracking-wider">
                  {t.supported}: .jpg .png .gif .webp .txt .md .pdf .json .csv
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera Modal */}
      {showCamera && (
        <CameraModal
          onCapture={(attachment) => {
            addAttachment(attachment);
            // Also archive to Gallery
            addToGallery({ id: attachment.id, name: attachment.name, dataUrl: attachment.dataUrl, timestamp: new Date().toISOString() });
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Knowledge Base Panel */}
      <KnowledgeBasePanel isOpen={showKB} onClose={() => setShowKB(false)} />

      {/* Documents Panel */}
      <DocumentsPanel isOpen={showDocs} onClose={() => setShowDocs(false)} />

      {/* Export Panel */}
      <ExportPanel
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        sessionTitle={activeSession?.title ?? 'Session'}
        messages={messages}
      />
    </div>
  );
}

function AttachmentChip({
  att,
  onRemove,
  onAnalyze,
  isAnalyzing,
  showPresets,
  onTogglePresets,
}: {
  att: Attachment;
  onRemove: (id: string) => void;
  onAnalyze?: (att: Attachment, prompt: string) => void;
  isAnalyzing?: boolean;
  showPresets?: boolean;
  onTogglePresets?: () => void;
}) {
  const isImage = att.mimeType.startsWith('image/');
  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 bg-bg-app border-2 border-glass-border px-2 py-1 text-[10px] font-mono shadow-[2px_2px_0px_var(--color-shadow-hard)]">
        {isImage ? (
          <img src={att.dataUrl} alt={att.name} className="w-5 h-5 object-cover border border-glass-border" />
        ) : (
          <FileText size={12} className="text-text-secondary flex-shrink-0" />
        )}
        <span className="max-w-[100px] truncate text-text-primary">{att.name}</span>
        <span className="text-text-secondary">({formatBytes(att.size)})</span>

        {/* Vision analyze button — images only */}
        {isImage && onAnalyze && (
          <button
            type="button"
            onClick={onTogglePresets}
            disabled={isAnalyzing}
            className="text-text-secondary hover:text-text-primary transition-colors ml-0.5 disabled:opacity-40"
            title="Analyze with local vision AI (Ollama)"
          >
            {isAnalyzing
              ? <Loader2 size={10} className="animate-spin" />
              : <ScanText size={10} />
            }
          </button>
        )}

        <button
          type="button"
          onClick={() => onRemove(att.id)}
          className="text-text-secondary hover:text-text-primary transition-colors ml-0.5"
        >
          <X size={10} />
        </button>
      </div>

      {/* Vision preset dropdown */}
      {showPresets && isImage && (
        <div className="absolute bottom-full left-0 mb-1 z-30 bg-bg-app border-2 border-glass-border shadow-[4px_4px_0px_var(--color-shadow-hard)] min-w-[190px]">
          <div className="px-3 py-1.5 border-b-2 border-glass-border">
            <span className="text-[8px] font-bold font-mono uppercase tracking-widest text-text-secondary">
              Vision · Select mode
            </span>
          </div>
          {VISION_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onAnalyze!(att, preset.prompt)}
              className="w-full text-left px-3 py-2.5 text-[10px] font-mono font-bold text-text-primary hover:bg-text-primary hover:text-bg-app transition-colors uppercase tracking-wide border-b border-glass-border last:border-b-0"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function MessageBubble({
  msg, t, onDelete, onReply,
}: {
  msg: Message;
  t: import('@/context/LanguageContext').T;
  onDelete?: () => void;
  onReply?: () => void;
}) {
  const isUser = msg.role === 'user';
  const [hovered, setHovered] = React.useState(false);
  const [copiedInline, setCopiedInline] = React.useState(false);

  const handleInlineCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = msg.content;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedInline(true);
    setTimeout(() => setCopiedInline(false), 1800);
  };

  const { handleContextMenu, menuEl } = useChatContextMenu({
    content: msg.content,
    isUser,
    onReply,
    onDelete,
  });

  return (
    <>
      {menuEl}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25 }}
        className={cn('flex gap-4 max-w-3xl group', isUser ? 'flex-row-reverse ml-auto' : 'flex-row')}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Avatar */}
        <div className={cn(
          'w-9 h-9 flex-shrink-0 flex items-center justify-center border-2 border-glass-border overflow-hidden shadow-[2px_2px_0px_var(--color-shadow-hard)]',
          isUser ? 'bg-text-primary text-bg-app rounded-lg' : 'bg-bg-app text-text-primary rounded-full',
        )}>
          {isUser ? <User size={16} /> : <CharbotAvatar emotion="neutral" />}
        </div>

        {/* Bubble + attachments */}
        <div className={cn('flex flex-col gap-2 max-w-[85%]', isUser ? 'items-end' : 'items-start')}>
          {/* Attachment previews */}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {msg.attachments.map(att => (
                <AttachmentPreview key={att.id} att={att} />
              ))}
            </div>
          )}

          {/* Text bubble */}
          {msg.content && (
            <div
              className={cn(
                'relative flex flex-col space-y-1 p-4 border-2 border-glass-border',
                isUser
                  ? 'bg-text-primary text-bg-app shadow-[4px_4px_0px_rgba(0,0,0,0.2)] ink-bubble-user'
                  : 'bg-bg-app text-text-primary shadow-[4px_4px_0px_var(--color-shadow-hard)] ink-bubble-bot',
              )}
              onContextMenu={handleContextMenu}
            >
              {/* Header row */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={cn(
                  'text-[9px] font-bold uppercase tracking-widest font-mono',
                  isUser ? 'text-bg-app/50' : 'text-text-secondary',
                )}>
                  {isUser ? t.you : t.charbot}
                </span>

                {/* Inline copy button — visible on hover */}
                <AnimatePresence>
                  {hovered && msg.content && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.1 }}
                      onClick={handleInlineCopy}
                      title="Kopiuj"
                      className={cn(
                        'flex items-center gap-1 text-[9px] font-bold font-mono uppercase tracking-wide px-1.5 py-0.5 border transition-colors',
                        isUser
                          ? 'border-bg-app/30 text-bg-app/60 hover:border-bg-app/60 hover:text-bg-app'
                          : 'border-glass-border text-text-secondary hover:border-text-primary hover:text-text-primary',
                      )}
                    >
                      {copiedInline ? <Check size={9} /> : <Copy size={9} />}
                      {copiedInline ? 'OK' : 'Copy'}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              <div className={cn(
                'prose prose-sm max-w-none font-serif',
                isUser
                  ? 'prose-headings:text-bg-app prose-p:text-bg-app prose-strong:text-bg-app prose-code:text-bg-app prose-code:bg-white/20'
                  : 'prose-headings:text-text-primary prose-p:text-text-primary prose-strong:text-text-primary prose-code:text-text-primary prose-code:bg-black/5',
                'prose-p:leading-relaxed',
                'prose-code:font-mono prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none',
              )}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    pre({ children }) {
                      const codeEl = React.Children.toArray(children).find(
                        (c): c is React.ReactElement => React.isValidElement(c) && (c.type === 'code' || (c as any).props?.className),
                      ) as React.ReactElement<{ className?: string; children?: React.ReactNode }> | undefined;
                      const className: string = codeEl?.props?.className ?? '';
                      const lang = className.replace('language-', '');
                      const match = /^([a-z]+):(.+\.\w+)$/.exec(lang);
                      if (match) {
                        const [, fmt, fname] = match;
                        const ARTIFACT_FORMATS = new Set(['txt', 'md', 'html', 'json', 'csv', 'pdf']);
                        if (ARTIFACT_FORMATS.has(fmt)) {
                          const content = String(codeEl?.props?.children ?? '').replace(/\n$/, '');
                          return <ArtifactCard format={fmt} filename={fname} content={content} />;
                        }
                      }
                      return (
                        <pre className="!bg-[#1a1a1a] !text-[#f2f0eb] border-2 border-glass-border shadow-[2px_2px_0px_var(--color-shadow-hard)] overflow-x-auto [&_code]:!text-[#f2f0eb] [&_code]:!bg-transparent [&_code]:!p-0 [&_code]:!border-0">
                          {children}
                        </pre>
                      );
                    },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Tool call bubbles */}
          {msg.toolCalls && msg.toolCalls.length > 0 && (
            <div className="w-full space-y-1">
              {msg.toolCalls.map(tc => (
                <ToolCallBubble key={tc.id} call={tc} />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

function AttachmentPreview({ att }: { att: Attachment }) {
  const isImage = att.mimeType.startsWith('image/');

  if (isImage) {
    return (
      <div className="border-2 border-glass-border overflow-hidden shadow-[2px_2px_0px_var(--color-shadow-hard)]">
        <img
          src={att.dataUrl}
          alt={att.name}
          className="max-w-[200px] max-h-[200px] object-contain block"
        />
        <div className="px-2 py-1 text-[9px] font-mono text-text-secondary border-t border-glass-border bg-bg-app truncate max-w-[200px]">
          {att.name}
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-glass-border p-3 bg-bg-app shadow-[2px_2px_0px_var(--color-shadow-hard)] flex items-center gap-2 max-w-[200px]">
      <FileText size={20} className="text-text-secondary flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] font-bold font-mono truncate text-text-primary">{att.name}</div>
        <div className="text-[9px] font-mono text-text-secondary">{formatBytes(att.size)}</div>
      </div>
    </div>
  );
}

// ─── Camera Modal ─────────────────────────────────────────────────────────────

interface CameraDevice {
  deviceId: string;
  label: string;
}

interface CameraModalProps {
  onCapture: (attachment: Attachment) => void;
  onClose: () => void;
}

function CameraModal({ onCapture, onClose }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // FIX: Request getUserMedia FIRST to trigger the permission dialog.
  // Without this, enumerateDevices() returns empty deviceId strings (browser
  // withholds real IDs until permission is granted) — so the stream never starts.
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(tempStream => {
        // Permission granted — stop temp stream and enumerate real devices
        tempStream.getTracks().forEach(t => t.stop());
        if (cancelled) return null;
        return navigator.mediaDevices.enumerateDevices();
      })
      .then(all => {
        if (!all || cancelled) return;
        const videoDevs = all
          .filter(d => d.kind === 'videoinput')
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
        setDevices(videoDevs);
        if (videoDevs.length > 0) setSelectedDeviceId(videoDevs[0].deviceId);
        else { setIsLoading(false); setError('No camera devices found.'); }
      })
      .catch(err => {
        if (!cancelled) {
          setIsLoading(false);
          setError(err.name === 'NotAllowedError'
            ? 'Camera access denied. Allow camera permissions in your browser.'
            : `Camera error: ${err.message}`);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Start / switch stream when selected device changes
  useEffect(() => {
    if (!selectedDeviceId) return;
    let cancelled = false;
    const startStream = async () => {
      setIsLoading(true);
      setError(null);
      setCapturedDataUrl(null);
      streamRef.current?.getTracks().forEach(t => t.stop());
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: selectedDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setIsLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.name === 'NotAllowedError'
            ? 'Camera access denied.'
            : `Camera error: ${err.message}`);
          setIsLoading(false);
        }
      }
    };
    startStream();
    return () => { cancelled = true; };
  }, [selectedDeviceId]);

  // Cleanup streams on unmount
  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedDataUrl(dataUrl);
    streamRef.current?.getTracks().forEach(t => { t.enabled = false; });
  }, []);

  const retake = useCallback(() => {
    setCapturedDataUrl(null);
    streamRef.current?.getTracks().forEach(t => { t.enabled = true; });
  }, []);

  const confirm = useCallback(() => {
    if (!capturedDataUrl) return;
    const base64 = capturedDataUrl.split(',')[1] ?? '';
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    onCapture({
      id: `cam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `photo_${ts}.jpg`,
      mimeType: 'image/jpeg',
      size: Math.round(base64.length * 0.75),
      dataUrl: capturedDataUrl,
      base64,
    });
  }, [capturedDataUrl, onCapture]);

  const flipCamera = useCallback(() => {
    if (devices.length < 2) return;
    const idx = devices.findIndex(d => d.deviceId === selectedDeviceId);
    setSelectedDeviceId(devices[(idx + 1) % devices.length].deviceId);
  }, [devices, selectedDeviceId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const statusText = isLoading ? 'INIT…' : error ? 'ERROR' : capturedDataUrl ? 'CAPTURED' : 'READY';
  const currentLabel = devices.find(d => d.deviceId === selectedDeviceId)?.label;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 bg-bg-app flex flex-col overflow-hidden"
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b-4 border-glass-border flex-shrink-0">
        <button
          onClick={onClose}
          className="w-10 h-10 border-2 border-glass-border flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
        >
          <X size={18} />
        </button>
        <h2 className="text-sm font-bold uppercase tracking-tighter text-text-primary font-mono">
          Charbot OS // CAM_01
        </h2>
        <button
          onClick={flipCamera}
          disabled={devices.length < 2}
          title={devices.length > 1 ? 'Switch camera' : 'Only one camera detected'}
          className="w-10 h-10 border-2 border-glass-border flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* ── Viewfinder label ───────────────────────────────────── */}
      <div className="px-4 pt-3 pb-1 flex-shrink-0">
        <h3 className="text-2xl font-bold uppercase tracking-tighter text-text-primary font-mono leading-none">
          Live_Viewfinder
        </h3>
        {currentLabel && !error && (
          <p className="text-[8px] font-mono text-text-secondary uppercase tracking-widest mt-1 truncate">
            {currentLabel.length > 50 ? currentLabel.slice(0, 48) + '…' : currentLabel}
          </p>
        )}
      </div>

      {/* ── Viewfinder (fills remaining height) ───────────────── */}
      <div className="px-4 flex-1 min-h-0 pb-2">
        <div className="relative w-full h-full bg-black border-2 border-glass-border overflow-hidden">
          <video
            ref={videoRef}
            muted
            playsInline
            className={cn('w-full h-full object-cover', capturedDataUrl ? 'hidden' : 'block')}
          />
          {capturedDataUrl && (
            <img src={capturedDataUrl} alt="Captured" className="w-full h-full object-contain bg-black" />
          )}

          {/* Loading */}
          {isLoading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full"
              />
              <span className="text-[10px] font-mono text-white/60 uppercase tracking-widest">Starting camera…</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/95 p-6 text-center">
              <Camera size={32} className="text-red-400" />
              <p className="text-[11px] font-mono text-red-400 uppercase tracking-wide max-w-xs leading-relaxed">{error}</p>
            </div>
          )}

          {/* Rule-of-thirds grid + centre crosshair (live only) */}
          {!isLoading && !error && !capturedDataUrl && (
            <div className="absolute inset-0 pointer-events-none opacity-25">
              {/* Vertical dashed guides */}
              <div className="absolute top-0 bottom-0" style={{ left: '33.33%', width: 1, backgroundImage: 'repeating-linear-gradient(to bottom,white 0,white 8px,transparent 8px,transparent 16px)' }} />
              <div className="absolute top-0 bottom-0" style={{ left: '66.66%', width: 1, backgroundImage: 'repeating-linear-gradient(to bottom,white 0,white 8px,transparent 8px,transparent 16px)' }} />
              {/* Horizontal dashed guides */}
              <div className="absolute left-0 right-0" style={{ top: '33.33%', height: 1, backgroundImage: 'repeating-linear-gradient(to right,white 0,white 8px,transparent 8px,transparent 16px)' }} />
              <div className="absolute left-0 right-0" style={{ top: '66.66%', height: 1, backgroundImage: 'repeating-linear-gradient(to right,white 0,white 8px,transparent 8px,transparent 16px)' }} />
              {/* Crosshair */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8">
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white" />
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white" />
              </div>
            </div>
          )}

          {/* Captured badge */}
          {capturedDataUrl && (
            <div className="absolute top-3 left-3 bg-text-primary text-bg-app text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5">
              Captured
            </div>
          )}
        </div>
      </div>

      {/* Hidden canvas for snapshot */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ── Technical readouts ─────────────────────────────────── */}
      <div className="mx-4 border-y-2 border-glass-border grid grid-cols-3 divide-x-2 divide-glass-border flex-shrink-0">
        <div className="flex flex-col items-center py-2">
          <p className="text-[8px] font-mono text-text-secondary uppercase font-bold tracking-wider">ISO</p>
          <p className="text-sm font-mono font-bold text-text-primary">AUTO</p>
        </div>
        <div className="flex flex-col items-center py-2">
          <p className="text-[8px] font-mono text-text-secondary uppercase font-bold tracking-wider">Shutter</p>
          <p className="text-sm font-mono font-bold text-text-primary">AUTO</p>
        </div>
        <div className="flex flex-col items-center py-2">
          <p className="text-[8px] font-mono text-text-secondary uppercase font-bold tracking-wider">Status</p>
          <p className={cn(
            'text-sm font-mono font-bold',
            error ? 'text-red-500' : isLoading ? 'text-text-secondary' : capturedDataUrl ? 'text-green-500' : 'text-text-primary',
          )}>
            {statusText}
          </p>
        </div>
      </div>

      {/* ── Controls: Thumbnail | Shutter | Flip ───────────────── */}
      <div className="flex items-center justify-between px-8 py-5 flex-shrink-0">
        {/* Last captured thumbnail */}
        <div className="w-14 h-14 border-2 border-glass-border bg-black overflow-hidden shadow-[3px_3px_0px_var(--color-shadow-hard)] flex items-center justify-center flex-shrink-0">
          {capturedDataUrl
            ? <img src={capturedDataUrl} alt="Last capture" className="w-full h-full object-cover" />
            : <ImageIcon size={16} className="text-text-secondary/30" />
          }
        </div>

        {/* Shutter / Confirm */}
        <div className="flex flex-col items-center gap-2">
          {!capturedDataUrl ? (
            <button
              onClick={capture}
              disabled={isLoading || !!error}
              className={cn(
                'w-20 h-20 rounded-full bg-text-primary border-4 border-text-primary',
                'flex items-center justify-center',
                'shadow-[4px_4px_0px_var(--color-shadow-hard)]',
                'hover:scale-105 active:scale-90 transition-transform duration-75',
                'disabled:opacity-40 disabled:pointer-events-none',
              )}
              title="Capture"
            >
              {/* Inner ring → dot design from CAM_01 */}
              <div className="w-[52px] h-[52px] rounded-full border-2 border-bg-app/30 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-bg-app" />
              </div>
            </button>
          ) : (
            <>
              <button
                onClick={confirm}
                className={cn(
                  'w-20 h-20 rounded-full bg-green-500 border-4 border-green-600 text-white',
                  'flex items-center justify-center',
                  'shadow-[4px_4px_0px_var(--color-shadow-hard)]',
                  'hover:scale-105 active:scale-90 transition-transform duration-75',
                )}
                title="Use photo"
              >
                <Check size={28} />
              </button>
              <button
                onClick={retake}
                className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-secondary hover:text-text-primary transition-colors"
              >
                Retake
              </button>
            </>
          )}
        </div>

        {/* Flip / switch camera */}
        <button
          onClick={flipCamera}
          disabled={devices.length < 2}
          title="Switch camera"
          className={cn(
            'w-14 h-14 rounded-full border-2 border-glass-border bg-bg-app',
            'flex items-center justify-center text-text-secondary',
            'shadow-[3px_3px_0px_var(--color-shadow-hard)]',
            'hover:border-text-primary hover:text-text-primary transition-colors',
            'disabled:opacity-30 disabled:pointer-events-none',
          )}
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div className="px-4 pb-4 text-[8px] font-mono text-text-secondary/40 uppercase tracking-widest text-center flex-shrink-0">
        Webcam · USB Cam · GoPro (webcam mode) · Any UVC device
      </div>
    </motion.div>
  );
}
