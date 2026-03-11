import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSession } from '@/context/SessionContext';
import { useRoom } from '@/context/RoomContext';
import { PlusCircle, Search, Download, Trash2, MessageSquare, Edit2, X, Smartphone, Users, Lock, Globe, ChevronRight, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

interface SessionPanelProps {
  isOpen: boolean;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoomListItem {
  id: string;
  name: string;
  mode: string;
  password: boolean;
  participants: { id: string; username: string; color: string; model: string; online: boolean }[];
}

const MODE_LABEL: Record<string, string> = {
  own_model: 'własny model',
  panel: 'panel AI',
  mention: '@mention',
  debate: 'debata',
};

// ─── Rooms lobby (embedded in SessionPanel) ──────────────────────────────────

function RoomsTab() {
  const { enterRoom } = useRoom();
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create' | 'join'>('list');
  const [joiningRoom, setJoiningRoom] = useState<RoomListItem | null>(null);
  const secretRef = useRef('');

  // Create form state
  const [cName, setCName] = useState('');
  const [cMode, setCMode] = useState<'own_model' | 'panel' | 'mention' | 'debate'>('own_model');
  const [cPassword, setCPassword] = useState('');
  const [cDebatePro, setCDebatePro] = useState('Argumentuj ZA tezą');
  const [cDebateCon, setCDebateCon] = useState('Argumentuj PRZECIW tezie');
  const [cSaving, setCsaving] = useState(false);

  // Join form state
  const [jUsername, setJUsername] = useState('');
  const [jPassword, setJPassword] = useState('');
  const [jJoining, setJJoining] = useState(false);
  const [jError, setJError] = useState('');

  const H = useCallback(() => ({ 'X-App-Secret': secretRef.current }), []);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch secret lazily if not yet loaded
      if (!secretRef.current) {
        const d = await fetch('/api/init').then(r => r.json());
        secretRef.current = d.appSecret ?? '';
      }
      const r = await fetch('/api/rooms', { headers: H() });
      if (r.ok) setRooms(await r.json());
    } finally { setLoading(false); }
  }, [H]);

  // Load rooms on mount
  useEffect(() => { loadRooms(); }, []);

  // Refresh list whenever user returns to list view
  useEffect(() => { if (view === 'list') loadRooms(); }, [view]);

  const createRoom = async () => {
    if (!cName.trim()) return;
    setCsaving(true);
    try {
      const r = await fetch('/api/rooms', {
        method: 'POST',
        headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cName.trim(),
          mode: cMode,
          password: cPassword || undefined,
          debateTopicPro: cMode === 'debate' ? cDebatePro : undefined,
          debateTopicCon: cMode === 'debate' ? cDebateCon : undefined,
        }),
      });
      if (r.ok) {
        const room = await r.json();
        setCName(''); setCPassword(''); setView('list');
        loadRooms();
        // Auto-join as creator
        setJoiningRoom({ ...room, participants: [], password: !!cPassword });
        setView('join');
      }
    } finally { setCsaving(false); }
  };

  const joinRoom = async () => {
    if (!joiningRoom || !jUsername.trim()) return;
    setJJoining(true); setJError('');
    try {
      const r = await fetch(`/api/rooms/${joiningRoom.id}/join`, {
        method: 'POST',
        headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: jUsername.trim(), model: 'human', password: jPassword || undefined }),
      });
      const data = await r.json();
      if (!r.ok) { setJError(data.error ?? 'Błąd dołączania'); return; }
      enterRoom({ roomId: joiningRoom.id, participantId: data.id, username: data.username, model: data.model });
      setView('list'); setJoiningRoom(null);
    } catch (e: any) {
      setJError(e.message);
    } finally { setJJoining(false); }
  };

  const deleteRoom = async (id: string) => {
    await fetch(`/api/rooms/${id}`, { method: 'DELETE', headers: H() });
    loadRooms();
  };

  if (view === 'create') return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold font-mono uppercase tracking-[0.15em] text-text-secondary">Nowy pokój</span>
        <button onClick={() => setView('list')} className="text-text-secondary hover:text-text-primary"><X size={13} /></button>
      </div>

      <input
        value={cName} onChange={e => setCName(e.target.value)}
        placeholder="Nazwa pokoju"
        className="w-full px-3 py-2 bg-transparent border-2 border-glass-border focus:border-text-primary text-[11px] font-mono text-text-primary placeholder:text-text-secondary/50 focus:outline-none transition-colors"
      />

      <div>
        <p className="text-[9px] font-mono uppercase tracking-wider text-text-secondary mb-1.5">Tryb AI</p>
        <div className="grid grid-cols-2 gap-1">
          {(['own_model', 'panel', 'mention', 'debate'] as const).map(m => (
            <button
              key={m}
              onClick={() => setCMode(m)}
              className={cn(
                'py-1.5 text-[9px] font-bold font-mono uppercase tracking-wide border-2 transition-all',
                cMode === m
                  ? 'bg-text-primary text-bg-app border-text-primary'
                  : 'border-glass-border text-text-secondary hover:border-text-primary hover:text-text-primary',
              )}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      {cMode === 'debate' && (
        <div className="space-y-1.5">
          <input value={cDebatePro} onChange={e => setCDebatePro(e.target.value)}
            placeholder="Instrukcja dla modelu PRO"
            className="w-full px-3 py-2 bg-transparent border-2 border-glass-border focus:border-text-primary text-[10px] font-mono text-text-primary placeholder:text-text-secondary/50 focus:outline-none" />
          <input value={cDebateCon} onChange={e => setCDebateCon(e.target.value)}
            placeholder="Instrukcja dla modelu CONTRA"
            className="w-full px-3 py-2 bg-transparent border-2 border-glass-border focus:border-text-primary text-[10px] font-mono text-text-primary placeholder:text-text-secondary/50 focus:outline-none" />
        </div>
      )}

      <input
        value={cPassword} onChange={e => setCPassword(e.target.value)}
        placeholder="Hasło (opcjonalne)"
        type="password"
        className="w-full px-3 py-2 bg-transparent border-2 border-glass-border focus:border-text-primary text-[11px] font-mono text-text-primary placeholder:text-text-secondary/50 focus:outline-none"
      />

      <button
        onClick={createRoom}
        disabled={!cName.trim() || cSaving}
        className="w-full py-2.5 bg-text-primary text-bg-app text-[11px] font-bold font-mono uppercase tracking-wider border-2 border-text-primary shadow-[3px_3px_0px_#1A1A1A] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-40 disabled:pointer-events-none"
      >
        {cSaving ? 'Tworzę…' : 'Utwórz pokój'}
      </button>
    </div>
  );

  if (view === 'join' && joiningRoom) return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold font-mono uppercase tracking-[0.15em] text-text-secondary">
          Dołącz: {joiningRoom.name}
        </span>
        <button onClick={() => { setView('list'); setJoiningRoom(null); setJError(''); }} className="text-text-secondary hover:text-text-primary"><X size={13} /></button>
      </div>

      <input
        value={jUsername} onChange={e => setJUsername(e.target.value)}
        placeholder="Twoja nazwa użytkownika"
        autoFocus
        className="w-full px-3 py-2 bg-transparent border-2 border-glass-border focus:border-text-primary text-[11px] font-mono text-text-primary placeholder:text-text-secondary/50 focus:outline-none"
      />
      {joiningRoom.password && (
        <input
          value={jPassword} onChange={e => setJPassword(e.target.value)}
          placeholder="Hasło pokoju"
          type="password"
          className="w-full px-3 py-2 bg-transparent border-2 border-glass-border focus:border-text-primary text-[11px] font-mono text-text-primary placeholder:text-text-secondary/50 focus:outline-none"
        />
      )}

      {jError && (
        <p className="text-[10px] font-mono text-red-500 border border-red-300 px-2 py-1.5">{jError}</p>
      )}

      <button
        onClick={joinRoom}
        disabled={!jUsername.trim() || jJoining}
        className="w-full py-2.5 bg-text-primary text-bg-app text-[11px] font-bold font-mono uppercase tracking-wider border-2 border-text-primary shadow-[3px_3px_0px_#1A1A1A] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-40 disabled:pointer-events-none"
      >
        {jJoining ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
        {jJoining ? 'Dołączam…' : 'Wejdź do pokoju'}
      </button>
    </div>
  );

  // Default: room list
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-glass-border">
        <button
          onClick={() => setView('create')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-text-primary text-bg-app text-[11px] font-bold font-mono uppercase tracking-wider border-2 border-text-primary shadow-[3px_3px_0px_#1A1A1A] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
        >
          <Plus size={12} />
          Nowy pokój
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-text-secondary" />
          </div>
        )}
        {!loading && rooms.length === 0 && (
          <div className="py-8 text-center text-[10px] font-mono text-text-secondary uppercase tracking-wider">
            Brak pokojów
          </div>
        )}
        {rooms.map(room => {
          const online = room.participants.filter(p => p.online).length;
          return (
            <div key={room.id} className="mb-1 border-2 border-glass-border hover:border-text-primary transition-colors group">
              <button
                onClick={() => { setJoiningRoom(room); setView('join'); }}
                className="w-full text-left px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {room.password
                        ? <Lock size={9} className="text-text-secondary flex-shrink-0" />
                        : <Globe size={9} className="text-text-secondary flex-shrink-0" />
                      }
                      <span className="text-[11px] font-bold font-mono text-text-primary uppercase truncate tracking-wide">
                        {room.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold font-mono uppercase tracking-[0.1em] px-1 py-px bg-text-primary/8 text-text-secondary border border-glass-border">
                        {MODE_LABEL[room.mode] ?? room.mode}
                      </span>
                      <span className="flex items-center gap-0.5 text-[9px] font-mono text-text-secondary">
                        <Users size={9} />
                        {online}/{room.participants.length}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={12} className="text-text-secondary flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
              <div className="flex border-t border-glass-border opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => deleteRoom(room.id)}
                  className="flex-1 py-1 text-[9px] font-mono text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors uppercase tracking-wider"
                >
                  Usuń
                </button>
                <button
                  onClick={() => { loadRooms(); }}
                  className="flex-1 py-1 text-[9px] font-mono text-text-secondary hover:text-text-primary hover:bg-black/5 transition-colors uppercase tracking-wider border-l border-glass-border"
                >
                  Odśwież
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main SessionPanel ────────────────────────────────────────────────────────

export function SessionPanel({ isOpen }: SessionPanelProps) {
  const {
    sessions, activeSessionId,
    createSession, switchSession, deleteSession, renameSession, exportSession,
  } = useSession();

  const [activeTab, setActiveTab] = useState<'sessions' | 'rooms'>('sessions');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [exportingMobile, setExportingMobile] = useState(false);
  const [exportResult, setExportResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const handleMobileExport = async () => {
    setExportingMobile(true);
    try {
      await fetch('/api/sessions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions }),
      }).catch(() => {});

      const res = await fetch('/api/mobile/generate', { method: 'POST' });
      let data: any = {};
      try {
        const text = await res.text();
        if (text.trim()) data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned invalid response (HTTP ${res.status}). Make sure the Charbot server is running: npm run dev`);
      }
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      setExportResult({ ok: true, msg: `Saved → ${data.outDir}` });
    } catch (err: any) {
      setExportResult({ ok: false, msg: err.message });
    } finally {
      setExportingMobile(false);
      setTimeout(() => setExportResult(null), 6000);
    }
  };

  const filtered = [...sessions]
    .filter(s => s.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const startEdit = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditTitle(title);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const saveEdit = () => {
    if (editingId) renameSession(editingId, editTitle.trim() || 'Untitled');
    setEditingId(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 264, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="flex flex-col h-full border-r-2 border-glass-border bg-bg-app overflow-hidden flex-shrink-0"
        >
          {/* Tab bar */}
          <div className="flex border-b-2 border-glass-border flex-shrink-0">
            {(['sessions', 'rooms'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 py-2.5 text-[10px] font-bold font-mono uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5',
                  activeTab === tab
                    ? 'bg-text-primary text-bg-app'
                    : 'text-text-secondary hover:text-text-primary hover:bg-black/5',
                )}
              >
                {tab === 'sessions' ? <MessageSquare size={11} /> : <Users size={11} />}
                {tab === 'sessions' ? 'Sesje' : 'Pokoje'}
              </button>
            ))}
          </div>

          {/* Sessions tab */}
          {activeTab === 'sessions' && (
            <>
              {/* Header — New Session + Export to Phone */}
              <div className="p-3 border-b-2 border-glass-border flex flex-col gap-2">
                <button
                  onClick={() => createSession()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-text-primary text-bg-app text-[11px] font-bold font-mono uppercase tracking-wider border-2 border-text-primary shadow-[4px_4px_0px_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <PlusCircle size={13} />
                  New Session
                </button>
                <button
                  onClick={handleMobileExport}
                  disabled={exportingMobile}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-[10px] font-bold font-mono uppercase tracking-wider border-2 border-glass-border hover:border-text-primary text-text-secondary hover:text-text-primary transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Smartphone size={11} />
                  {exportingMobile ? 'Generating…' : 'Export to Phone'}
                </button>
                {exportResult && (
                  <div className={cn(
                    'text-[9px] font-mono px-2 py-1.5 border leading-snug break-all',
                    exportResult.ok
                      ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20'
                      : 'border-red-400 bg-red-50 text-red-600 dark:bg-red-900/20',
                  )}>
                    {exportResult.ok ? '✓ ' : '✕ '}{exportResult.msg}
                  </div>
                )}
              </div>

              {/* Search */}
              <div className="px-3 py-2.5 border-b-2 border-glass-border">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Filter sessions..."
                    className="w-full pl-8 pr-3 py-2 bg-transparent border-b-2 border-glass-border text-[11px] font-mono text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-text-primary transition-colors"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Section Label */}
              <div className="px-3 pt-3 pb-1 flex items-center justify-between">
                <span className="text-[9px] font-bold font-mono uppercase tracking-[0.15em] text-text-secondary">
                  Recent Sessions
                </span>
                <span className="text-[9px] font-mono text-text-secondary/50 uppercase tracking-wider">
                  Last 50
                </span>
              </div>

              {/* Session List */}
              <div className="flex-1 overflow-y-auto px-2 pb-4">
                {filtered.length === 0 && (
                  <div className="py-8 text-center text-[11px] font-mono text-text-secondary uppercase tracking-wider">
                    {search ? 'No matches' : 'No sessions yet'}
                  </div>
                )}

                <AnimatePresence>
                  {filtered.map(session => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      className="relative group mb-1 bleed-hover-effect"
                    >
                      {editingId === session.id ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 border-2 border-text-primary bg-bg-app shadow-[2px_2px_0px_#1A1A1A]">
                          <input
                            ref={editInputRef}
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="flex-1 bg-transparent text-[11px] font-bold font-mono text-text-primary focus:outline-none uppercase tracking-wide"
                          />
                        </div>
                      ) : confirmDeleteId === session.id ? (
                        <div className="px-3 py-2.5 border-2 border-red-500 bg-red-50 dark:bg-red-900/20">
                          <p className="text-[10px] font-bold font-mono text-red-600 uppercase mb-2">Delete session?</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { deleteSession(session.id); setConfirmDeleteId(null); }}
                              className="flex-1 py-1 bg-red-500 text-white text-[10px] font-bold font-mono uppercase border-2 border-red-600 hover:bg-red-600 transition-colors"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="flex-1 py-1 text-[10px] font-bold font-mono uppercase border-2 border-glass-border hover:bg-black/5 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => switchSession(session.id)}
                          className={cn(
                            'w-full text-left px-3 py-2.5 border-2 transition-all duration-75 flex items-start gap-2',
                            session.id === activeSessionId
                              ? 'bg-text-primary text-bg-app border-text-primary shadow-[2px_2px_0px_rgba(0,0,0,0.15)]'
                              : 'bg-bg-app text-text-primary border-transparent hover:border-glass-border hover:shadow-[2px_2px_0px_#1A1A1A]',
                          )}
                        >
                          <MessageSquare size={11} className="flex-shrink-0 mt-0.5 opacity-50" />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold font-mono uppercase truncate tracking-wide">
                              {session.title}
                            </div>
                            <div className={cn(
                              'text-[9px] font-normal font-mono mt-0.5 normal-case',
                              session.id === activeSessionId ? 'text-bg-app/60' : 'text-text-secondary',
                            )}>
                              {relativeTime(session.updatedAt)} · {session.messages.length} msg{session.messages.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </button>
                      )}

                      {editingId !== session.id && confirmDeleteId !== session.id && session.id !== activeSessionId && (
                        <div className="absolute right-0.5 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-px bg-bg-app border-2 border-glass-border shadow-[2px_2px_0px_#1A1A1A] px-0.5">
                          <button
                            onClick={e => startEdit(session.id, session.title, e)}
                            className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
                            title="Rename"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); exportSession(session.id); }}
                            className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
                            title="Export"
                          >
                            <Download size={11} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDeleteId(session.id); }}
                            className="p-1.5 text-text-secondary hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}

          {/* Rooms tab */}
          {activeTab === 'rooms' && <RoomsTab />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
