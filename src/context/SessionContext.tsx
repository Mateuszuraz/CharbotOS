import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Message } from '@/types/chat';

const MAX_SESSIONS = 50;

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

interface SessionContextType {
  sessions: Session[];
  activeSessionId: string | null;
  activeSession: Session | null;
  createSession: (title?: string) => string;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  updateSession: (id: string, data: Partial<Pick<Session, 'messages' | 'title' | 'updatedAt'>>) => void;
  exportSession: (id: string) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

function genId(): string {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Strip base64 data from attachments before persisting to avoid quota exhaustion. */
function stripBase64(sessions: Session[]): Session[] {
  return sessions.map(s => ({
    ...s,
    messages: s.messages.map(m => ({
      ...m,
      attachments: m.attachments?.map(a => ({
        ...a,
        dataUrl: a.mimeType?.startsWith('image/') ? '[image]' : a.dataUrl,
        base64: '',
      })),
    })),
  }));
}

function loadSessions(): Session[] {
  try {
    const raw = JSON.parse(localStorage.getItem('charbot-sessions') || '[]');
    // Migration: ensure required fields exist
    return (raw as any[]).map(s => ({
      id: s.id || genId(),
      title: s.title || 'Untitled',
      messages: (s.messages || []).map((m: any) => ({
        id: m.id || Date.now().toString(),
        role: m.role || 'user',
        content: m.content || '',
        attachments: m.attachments || [],
      })),
      createdAt: s.createdAt || new Date().toISOString(),
      updatedAt: s.updatedAt || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

function persist(sessions: Session[], activeId: string | null) {
  // Keep only last MAX_SESSIONS sorted by updatedAt
  const capped = [...sessions]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, MAX_SESSIONS);
  localStorage.setItem('charbot-sessions', JSON.stringify(stripBase64(capped)));
  localStorage.setItem('charbot-activeSession', activeId || '');
}

/** Sync sessions to server DB (fire-and-forget). */
async function syncToServer(sessions: Session[]): Promise<void> {
  try {
    await fetch('/api/sessions/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions }),
    });
  } catch {
    // Server may not be running in dev — silently ignore
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>(loadSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const saved = localStorage.getItem('charbot-activeSession');
    const sessions = loadSessions();
    if (saved && sessions.find(s => s.id === saved)) return saved;
    return null;
  });

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null;

  // Debounced server sync — only after loading settles
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => syncToServer(sessions), 2000);
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [sessions]);

  const createSession = useCallback((title = 'New Session'): string => {
    const id = genId();
    const now = new Date().toISOString();
    const session: Session = { id, title, messages: [], createdAt: now, updatedAt: now };
    setSessions(prev => {
      const updated = [session, ...prev];
      persist(updated, id);
      return updated;
    });
    setActiveSessionId(id);
    return id;
  }, []);

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id);
    localStorage.setItem('charbot-activeSession', id);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      const newActive = activeSessionId === id ? (updated[0]?.id ?? null) : activeSessionId;
      persist(updated, newActive);
      setActiveSessionId(newActive);
      return updated;
    });
  }, [activeSessionId]);

  const renameSession = useCallback((id: string, title: string) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, title } : s);
      persist(updated, activeSessionId);
      return updated;
    });
  }, [activeSessionId]);

  const updateSession = useCallback((
    id: string,
    data: Partial<Pick<Session, 'messages' | 'title' | 'updatedAt'>>,
  ) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, ...data } : s);
      persist(updated, activeSessionId);
      return updated;
    });
  }, [activeSessionId]);

  const exportSession = useCallback((id: string) => {
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    const text = [
      `# ${session.title}`,
      `Exported: ${new Date().toLocaleString()}`,
      `Messages: ${session.messages.length}`,
      '',
      ...session.messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`),
    ].join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sessions]);

  return (
    <SessionContext.Provider value={{
      sessions, activeSessionId, activeSession,
      createSession, switchSession, deleteSession, renameSession, updateSession, exportSession,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
