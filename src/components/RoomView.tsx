import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { useRoom } from '@/context/RoomContext';
import {
  LogOut, Copy, Check, Users, Wifi, WifiOff, Loader2,
  Send, Bot, User, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RoomInfo {
  id: string;
  name: string;
  mode: 'own_model' | 'panel' | 'mention' | 'debate';
  password: boolean;
  participants: RoomParticipant[];
}

interface RoomParticipant {
  id: string;
  username: string;
  color: string;
  model: string;
  isActive: number;
  online: boolean;
}

interface RoomMessage {
  id: string;
  roomId: string;
  authorId: string;
  authorName: string;
  authorType: 'human' | 'ai';
  model: string | null;
  content: string;
  replyToId: string | null;
  createdAt: string;
}

interface StreamingMsg {
  model: string;
  content: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MODE_LABEL: Record<string, string> = {
  own_model: 'własny model',
  panel: 'panel AI',
  mention: '@mention',
  debate: 'debata',
};

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'teraz';
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RoomView() {
  const { roomSession, leaveRoom } = useRoom();
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [streaming, setStreaming] = useState<Record<string, StreamingMsg>>({}); // model → partial
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [wsState, setWsState] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const appSecret = useRef('');
  const lanIp = useRef<string | null>(null);

  // Get APP_SECRET + LAN IP
  useEffect(() => {
    fetch('/api/init').then(r => r.json()).then(d => {
      appSecret.current = d.appSecret ?? '';
      lanIp.current = d.lanIp ?? null;
    });
  }, []);

  // Load room info + history
  useEffect(() => {
    if (!roomSession) return;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const loadSecret = () => fetch('/api/init').then(r => r.json()).then(d => d.appSecret ?? '');

    (async () => {
      const secret = await loadSecret();
      appSecret.current = secret;
      const h = { 'X-App-Secret': secret };

      const [roomRes, msgsRes] = await Promise.all([
        fetch(`/api/rooms/${roomSession.roomId}`, { headers: h }),
        fetch(`/api/rooms/${roomSession.roomId}/messages?limit=100`, { headers: h }),
      ]);
      if (roomRes.ok) setRoom(await roomRes.json());
      if (msgsRes.ok) setMessages(await msgsRes.json());
    })();
  }, [roomSession?.roomId]);

  // WebSocket connection
  useEffect(() => {
    if (!roomSession) return;
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      setWsState('connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws/room/${roomSession.roomId}?secret=${encodeURIComponent(appSecret.current)}&participantId=${encodeURIComponent(roomSession.participantId)}`;
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setWsState('open');
      ws.onclose = () => {
        setWsState('closed');
        reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          handleWsEvent(data);
        } catch { /* ignore */ }
      };
    };

    // Wait for appSecret to be ready (poll briefly)
    const tryConnect = () => {
      if (appSecret.current) { connect(); return; }
      setTimeout(tryConnect, 100);
    };
    tryConnect();

    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [roomSession?.roomId, roomSession?.participantId]);

  const handleWsEvent = useCallback((data: any) => {
    switch (data.type) {
      case 'presence':
        setParticipants(data.participants ?? []);
        break;
      case 'join':
        setParticipants(prev => {
          const filtered = prev.filter(p => p.id !== data.participant.id);
          return [...filtered, { ...data.participant, online: true }];
        });
        break;
      case 'leave':
        setParticipants(prev => prev.map(p =>
          p.id === data.participantId ? { ...p, online: false } : p
        ));
        break;
      case 'message':
        setMessages(prev => {
          if (prev.find(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        break;
      case 'ai_start':
        setStreaming(prev => ({ ...prev, [data.model]: { model: data.model, content: '' } }));
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        break;
      case 'ai_token':
        setStreaming(prev => ({
          ...prev,
          [data.model]: { model: data.model, content: (prev[data.model]?.content ?? '') + data.token },
        }));
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'ai_done':
        setStreaming(prev => { const n = { ...prev }; delete n[data.model]; return n; });
        setMessages(prev => {
          if (prev.find(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        break;
      case 'system':
        setMessages(prev => [...prev, {
          id: `sys-${Date.now()}`, roomId: roomSession?.roomId ?? '',
          authorId: 'system', authorName: 'System', authorType: 'ai', model: null,
          content: `ℹ️ ${data.content}`, replyToId: null,
          createdAt: new Date().toISOString(),
        }]);
        break;
    }
  }, [roomSession?.roomId]);

  const sendMessage = () => {
    const content = input.trim();
    if (!content || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setSending(true);
    wsRef.current.send(JSON.stringify({ type: 'message', content }));
    setInput('');
    setSending(false);
    inputRef.current?.focus();
  };

  const copyLink = async () => {
    if (!roomSession) return;
    const port = window.location.port ? `:${window.location.port}` : '';
    const host = lanIp.current ?? window.location.hostname;
    const origin = `${window.location.protocol}//${host}${port}`;
    await navigator.clipboard.writeText(`${origin}?room=${roomSession.roomId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!roomSession) return null;

  const onlineCount = participants.filter(p => p.online).length;
  const streamingList = Object.values(streaming);

  return (
    <div className="flex flex-col h-full bg-bg-app">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-glass-border bg-bg-app flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-2 h-2 rounded-full flex-shrink-0',
              wsState === 'open' ? 'bg-green-500' : wsState === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-500',
            )} />
            <span className="text-sm font-bold font-mono text-text-primary uppercase tracking-wide">
              {room?.name ?? '…'}
            </span>
          </div>
          {room && (
            <span className="text-[9px] font-bold font-mono uppercase tracking-[0.12em] px-2 py-0.5 bg-text-primary/10 text-text-secondary border border-glass-border">
              {MODE_LABEL[room.mode]}
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] font-mono text-text-secondary">
            <Users size={11} />
            {onlineCount} online
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection indicator */}
          {wsState === 'connecting' && <Loader2 size={13} className="animate-spin text-text-secondary" />}
          {wsState === 'closed' && <WifiOff size={13} className="text-red-500" />}
          {wsState === 'open' && <Wifi size={13} className="text-green-500" />}

          <button
            onClick={() => setShowSidebar(p => !p)}
            className="p-1.5 border border-glass-border hover:border-text-primary text-text-secondary hover:text-text-primary transition-colors"
            title="Toggle participants"
          >
            <Users size={13} />
          </button>

          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wider border border-glass-border hover:border-text-primary text-text-secondary hover:text-text-primary transition-colors"
          >
            {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
            {copied ? 'Skopiowano' : 'Kopiuj link'}
          </button>

          <button
            onClick={leaveRoom}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wider border border-red-300 hover:border-red-500 text-red-400 hover:text-red-600 transition-colors"
          >
            <LogOut size={11} />
            Opuść
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && streamingList.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-text-secondary">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-sm font-mono font-bold uppercase tracking-wider">Pokój gotowy</p>
                <p className="text-xs font-mono mt-1 opacity-60">
                  {room?.mode === 'mention' ? 'Użyj @modelname żeby wywołać AI' :
                   room?.mode === 'debate' ? 'Podaj tezę — AI rozpocznie debatę' :
                   'Napisz wiadomość, żeby zacząć'}
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <RoomMessageBubble
                key={msg.id}
                msg={msg}
                isOwn={msg.authorId === roomSession.participantId}
                participants={participants}
              />
            ))}

            {/* Streaming AI responses */}
            {streamingList.map((s) => (
              <StreamingBubble key={s.model} model={s.model} content={s.content} />
            ))}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 px-4 py-3 border-t-2 border-glass-border bg-bg-app">
            {room?.mode === 'mention' && (
              <p className="text-[9px] font-mono text-text-secondary/60 mb-1.5 uppercase tracking-wider">
                Tryb @mention — zacznij od @{participants.find(p => p.model)?.model ?? 'modelname'} żeby wywołać AI
              </p>
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1 relative border-2 border-glass-border focus-within:border-text-primary transition-colors bg-bg-app shadow-[2px_2px_0px_var(--color-shadow-hard)]">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                  }}
                  placeholder="Napisz wiadomość… (Enter = wyślij, Shift+Enter = nowa linia)"
                  rows={1}
                  className="w-full bg-transparent px-3 py-2.5 text-sm font-serif text-text-primary placeholder:text-text-secondary/40 resize-none focus:outline-none max-h-[120px]"
                  style={{ minHeight: '44px' }}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending || wsState !== 'open'}
                className="p-3 bg-text-primary text-bg-app border-2 border-text-primary shadow-[3px_3px_0px_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-40 disabled:pointer-events-none flex-shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
            <p className="mt-1 text-[9px] font-mono text-text-secondary/50 uppercase tracking-wider">
              Twój model: <span className="text-text-primary font-bold">{roomSession.model}</span>
            </p>
          </div>
        </div>

        {/* Participants sidebar */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 200, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex-shrink-0 border-l-2 border-glass-border bg-bg-app overflow-hidden"
            >
              <div className="w-[200px] h-full flex flex-col">
                <div className="px-3 py-2.5 border-b border-glass-border">
                  <span className="text-[9px] font-bold font-mono uppercase tracking-[0.15em] text-text-secondary">
                    Uczestnicy
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto py-2">
                  {/* Human participants */}
                  {participants.map(p => (
                    <div key={p.id} className="flex items-center gap-2 px-3 py-2">
                      <div className="relative flex-shrink-0">
                        <div
                          className="w-6 h-6 flex items-center justify-center text-[10px] font-bold font-mono text-white"
                          style={{ background: p.color }}
                        >
                          {p.username[0]?.toUpperCase()}
                        </div>
                        <div className={cn(
                          'absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-bg-app',
                          p.online ? 'bg-green-500' : 'bg-gray-400',
                        )} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold font-mono text-text-primary truncate">
                          {p.username}
                          {p.id === roomSession.participantId && (
                            <span className="ml-1 text-[8px] text-text-secondary normal-case font-normal">(ty)</span>
                          )}
                        </p>
                        <p className="text-[9px] font-mono text-text-secondary truncate">{p.model}</p>
                      </div>
                    </div>
                  ))}

                  {participants.length === 0 && (
                    <p className="px-3 py-4 text-[10px] font-mono text-text-secondary/50 text-center">
                      Brak uczestników
                    </p>
                  )}

                  {/* Active AI models */}
                  {[...new Set(participants.map(p => p.model))].length > 0 && (
                    <>
                      <div className="px-3 py-2 mt-2 border-t border-glass-border">
                        <span className="text-[9px] font-bold font-mono uppercase tracking-[0.15em] text-text-secondary">
                          Modele AI
                        </span>
                      </div>
                      {[...new Set(participants.filter(p => p.isActive).map(p => p.model))].map(model => (
                        <div key={model} className="flex items-center gap-2 px-3 py-2">
                          <div className="w-6 h-6 bg-text-primary/10 border border-glass-border flex items-center justify-center flex-shrink-0">
                            <Bot size={11} className="text-text-secondary" />
                          </div>
                          <p className="text-[10px] font-mono text-text-secondary truncate">{model}</p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function RoomMessageBubble({
  msg, isOwn, participants,
}: {
  msg: RoomMessage;
  isOwn: boolean;
  participants: RoomParticipant[];
}) {
  const isAI = msg.authorType === 'ai';
  const participant = participants.find(p => p.id === msg.authorId);
  const authorColor = participant?.color ?? '#888';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn('flex gap-2.5 max-w-3xl', isOwn && !isAI ? 'ml-auto flex-row-reverse' : '')}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        {isAI ? (
          <div className="w-7 h-7 bg-text-primary border-2 border-text-primary flex items-center justify-center">
            <Bot size={13} className="text-bg-app" />
          </div>
        ) : (
          <div
            className="w-7 h-7 flex items-center justify-center text-[11px] font-bold font-mono text-white border-2"
            style={{ background: authorColor, borderColor: authorColor }}
          >
            {msg.authorName[0]?.toUpperCase()}
          </div>
        )}
      </div>

      {/* Bubble */}
      <div className={cn('flex flex-col gap-0.5', isOwn && !isAI ? 'items-end' : 'items-start')}>
        {/* Author + time */}
        <div className="flex items-center gap-2 px-1">
          <span
            className="text-[10px] font-bold font-mono uppercase tracking-wide"
            style={{ color: isAI ? 'var(--color-text-secondary)' : authorColor }}
          >
            {isAI ? `🤖 ${msg.model}` : msg.authorName}
          </span>
          <span className="text-[9px] font-mono text-text-secondary/40">
            {relTime(msg.createdAt)}
          </span>
        </div>

        {/* Content */}
        <div className={cn(
          'px-4 py-3 border-2 text-sm',
          isAI
            ? 'bg-bg-app border-glass-border shadow-[3px_3px_0px_var(--color-shadow-hard)]'
            : isOwn
            ? 'bg-text-primary text-bg-app border-text-primary shadow-[3px_3px_0px_#1A1A1A]'
            : 'bg-bg-app border-glass-border shadow-[3px_3px_0px_var(--color-shadow-hard)]',
          { borderColor: !isAI && !isOwn ? authorColor : undefined } as any
        )}
          style={!isAI && !isOwn ? { borderColor: authorColor } : undefined}
        >
          {isAI ? (
            <div className="prose prose-sm max-w-none font-serif prose-p:text-text-primary prose-headings:text-text-primary prose-strong:text-text-primary prose-code:text-text-primary prose-code:bg-black/5 prose-p:leading-relaxed prose-code:font-mono prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre({ children }) {
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
          ) : (
            <p className={cn(
              'text-sm font-serif whitespace-pre-wrap leading-relaxed',
              isOwn ? 'text-bg-app' : 'text-text-primary',
            )}>
              {msg.content}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Streaming bubble ─────────────────────────────────────────────────────────

function StreamingBubble({ model, content }: { model: string; content: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2.5 max-w-3xl"
    >
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-7 h-7 bg-text-primary border-2 border-text-primary flex items-center justify-center">
          <Bot size={13} className="text-bg-app" />
        </div>
      </div>
      <div className="flex flex-col gap-0.5 items-start">
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] font-bold font-mono uppercase tracking-wide text-text-secondary">
            🤖 {model}
          </span>
          <Loader2 size={10} className="animate-spin text-text-secondary" />
        </div>
        <div className="px-4 py-3 border-2 border-glass-border bg-bg-app shadow-[3px_3px_0px_var(--color-shadow-hard)] text-sm">
          {content ? (
            <p className="font-serif text-text-primary whitespace-pre-wrap leading-relaxed">
              {content}
              <span className="inline-block w-1.5 h-4 bg-text-primary ml-0.5 animate-pulse align-text-bottom" />
            </p>
          ) : (
            <div className="flex gap-1 py-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 bg-text-primary/40 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
