import React, { useState, useEffect, useRef } from 'react';
import { ChatInterface } from '@/components/ChatInterface';
import FlowEditorWrapper from '@/components/automation/FlowEditor.tsx';
import { SessionPanel } from '@/components/SessionPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { TemplateLibrary } from '@/components/TemplateLibrary';
import { Gallery } from '@/components/Gallery';
import { OnboardingWizard, isOnboardingDone } from '@/components/OnboardingWizard';
import { CharbotAvatar } from '@/components/ui/CharbotAvatar';
import { useSettings, isOfflineMode } from '@/context/SettingsContext';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { MessageSquare, Workflow, Settings as SettingsIcon, Sun, Moon, Monitor, PanelLeft, X, Check, WifiOff, BookOpen, Images, GraduationCap, Loader2, Users } from 'lucide-react';
import { useRoom } from '@/context/RoomContext';
import { RoomView } from '@/components/RoomView';
import { TutorialTooltip } from '@/components/ui/TutorialTooltip';
import { motion, AnimatePresence } from 'motion/react';

type View = 'chat' | 'automation' | 'gallery';

const THEMES = [
  { value: 'light' as const, label: 'Light Mode', Icon: Sun },
  { value: 'dark' as const, label: 'Dark Mode', Icon: Moon },
  { value: 'system' as const, label: 'System Default', Icon: Monitor },
];

export function Layout() {
  const { roomSession, enterRoom } = useRoom();
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingDone());
  const [currentView, setCurrentView] = useState<View>('chat');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showSessionPanel, setShowSessionPanel] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [pendingCamera, setPendingCamera] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);

  // Deep-link: ?room=<id> — show join modal automatically
  const [deepLinkRoomId, setDeepLinkRoomId] = useState<string | null>(null);
  const [deepLinkRoomName, setDeepLinkRoomName] = useState('');
  const [deepLinkUsername, setDeepLinkUsername] = useState('');
  const [deepLinkModel, setDeepLinkModel] = useState('llama3.2');
  const [deepLinkPassword, setDeepLinkPassword] = useState('');
  const [deepLinkJoining, setDeepLinkJoining] = useState(false);
  const [deepLinkError, setDeepLinkError] = useState('');
  const appSecretRef = useRef('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    if (!roomId || roomSession) return;

    // Remove ?room= from URL so refresh doesn't re-trigger
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    // Fetch appSecret + room info
    fetch('/api/init')
      .then(r => r.json())
      .then(async d => {
        appSecretRef.current = d.appSecret ?? '';
        const roomRes = await fetch(`/api/rooms/${roomId}`, {
          headers: { 'X-App-Secret': appSecretRef.current },
        });
        if (!roomRes.ok) { setDeepLinkError('Pokój nie istnieje lub wygasł.'); setDeepLinkRoomId(roomId); return; }
        const room = await roomRes.json();
        setDeepLinkRoomName(room.name ?? roomId);
        setDeepLinkRoomId(roomId);
      })
      .catch(() => { setDeepLinkRoomId(roomId); });
  }, []);

  const handleDeepLinkJoin = async () => {
    if (!deepLinkRoomId || !deepLinkUsername.trim()) return;
    setDeepLinkJoining(true); setDeepLinkError('');
    try {
      const r = await fetch(`/api/rooms/${deepLinkRoomId}/join`, {
        method: 'POST',
        headers: { 'X-App-Secret': appSecretRef.current, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: deepLinkUsername.trim(),
          model: deepLinkModel.trim(),
          password: deepLinkPassword || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setDeepLinkError(data.error ?? 'Błąd dołączania'); return; }
      enterRoom({ roomId: deepLinkRoomId, participantId: data.id, username: data.username, model: data.model });
      setDeepLinkRoomId(null);
    } catch (e: any) {
      setDeepLinkError(e.message);
    } finally { setDeepLinkJoining(false); }
  };

  const { settings, updateSettings } = useSettings();
  const { lang, setLang, t } = useLanguage();

  useEffect(() => {
    fetch('/api/update/check')
      .then(r => r.json())
      .then(d => { if (d.hasUpdate) setUpdateAvailable(d.latest); })
      .catch(() => {});
  }, []);

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = settings.theme === 'dark' || (settings.theme === 'system' && prefersDark);
    root.classList.toggle('dark', isDark);
  }, [settings.theme]);

  const currentTheme = THEMES.find(t => t.value === settings.theme) ?? THEMES[0];

  return (
    <div className="flex h-screen bg-bg-app text-text-primary font-serif overflow-hidden">
      {/* Update available banner */}
      {updateAvailable && (
        <div className="fixed top-0 inset-x-0 z-[300] flex items-center justify-between px-4 py-1.5 bg-yellow-400 text-yellow-900 text-[10px] font-bold font-mono uppercase tracking-wider shadow-md">
          <span>Update available — v{updateAvailable} ready to download</span>
          <button onClick={() => setUpdateAvailable(null)}>✕</button>
        </div>
      )}
      {/* Dark mode decorative background — mix-blend-mode:screen makes black=transparent, white lines glow */}
      <div
        className="fixed inset-0 z-[30] pointer-events-none opacity-0 dark:opacity-[0.13] transition-opacity duration-500"
        style={{
          backgroundImage: 'url(/bg-dark.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center bottom',
          backgroundRepeat: 'no-repeat',
          mixBlendMode: 'screen',
        }}
      />
      {/* Narrow icon sidebar */}
      <div className="w-16 md:w-20 border-r-2 border-glass-border bg-bg-app flex flex-col items-center py-6 gap-5 z-20 flex-shrink-0">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-full border-2 border-glass-border overflow-hidden">
          <CharbotAvatar emotion="happy" />
        </div>

        {/* Offline badge */}
        {isOfflineMode && (
          <div
            className="flex flex-col items-center gap-0.5 px-1 py-1 bg-text-primary text-bg-app w-full"
            title="Offline Mode — only local Ollama models available"
          >
            <WifiOff size={11} />
            <span className="text-[7px] font-bold font-mono uppercase tracking-wider leading-none">
              Offline
            </span>
          </div>
        )}

        {/* Nav buttons */}
        <div className="flex flex-col gap-3 w-full px-2">
          <TutorialTooltip tutorialKey="nav_chat" position="right">
            <NavButton
              active={currentView === 'chat'}
              onClick={() => setCurrentView('chat')}
              icon={<MessageSquare size={20} />}
              label={t.chat}
            />
          </TutorialTooltip>
          <TutorialTooltip tutorialKey="nav_flows" position="right">
            <NavButton
              active={currentView === 'automation'}
              onClick={() => setCurrentView('automation')}
              icon={<Workflow size={20} />}
              label={t.flows}
            />
          </TutorialTooltip>
          {currentView === 'chat' && (
            <TutorialTooltip tutorialKey="nav_sessions" position="right">
              <NavButton
                active={showSessionPanel}
                onClick={() => setShowSessionPanel(p => !p)}
                icon={<PanelLeft size={20} />}
                label={t.sessions}
              />
            </TutorialTooltip>
          )}
          {currentView === 'chat' && (
            <TutorialTooltip tutorialKey="nav_templates" position="right">
              <NavButton
                active={showTemplates}
                onClick={() => setShowTemplates(p => !p)}
                icon={<BookOpen size={20} />}
                label={lang === 'pl' ? 'Szablony' : 'Templates'}
              />
            </TutorialTooltip>
          )}
          <TutorialTooltip tutorialKey="nav_gallery" position="right">
            <NavButton
              active={currentView === 'gallery'}
              onClick={() => setCurrentView('gallery')}
              icon={<Images size={20} />}
              label={t.gallery}
            />
          </TutorialTooltip>
        </div>

        {/* Bottom buttons */}
        <div className="mt-auto flex flex-col gap-3 w-full px-2">
          {/* Tutorial toggle */}
          <TutorialTooltip tutorialKey="nav_tutorial" position="right">
            <button
              onClick={() => updateSettings({ tutorialEnabled: !settings.tutorialEnabled })}
              title={lang === 'pl' ? 'Tryb Samouczka' : 'Tutorial Mode'}
              className={cn(
                'w-full aspect-square flex flex-col items-center justify-center gap-1 transition-all duration-150 border-2',
                settings.tutorialEnabled
                  ? 'bg-text-primary text-bg-app border-text-primary shadow-[4px_4px_0px_rgba(0,0,0,0.15)]'
                  : 'bg-transparent text-text-secondary border-transparent hover:border-glass-border hover:text-text-primary',
              )}
            >
              <GraduationCap size={18} />
              <span className="text-[8px] font-bold font-mono uppercase tracking-wider">
                {lang === 'pl' ? 'Pomoc' : 'Help'}
              </span>
            </button>
          </TutorialTooltip>
          <TutorialTooltip tutorialKey="nav_theme" position="right">
            <NavButton
              active={showThemeModal}
              onClick={() => setShowThemeModal(true)}
              icon={<currentTheme.Icon size={20} />}
              label={lang === 'pl' ? 'Motyw' : 'Theme'}
            />
          </TutorialTooltip>
          <TutorialTooltip tutorialKey="nav_settings" position="right">
            <NavButton
              active={isSettingsOpen}
              onClick={() => setIsSettingsOpen(true)}
              icon={<SettingsIcon size={20} />}
              label={t.settings}
            />
          </TutorialTooltip>
        </div>
      </div>

      {/* Session Panel (chat view only) */}
      {currentView === 'chat' && (
        <SessionPanel isOpen={showSessionPanel} />
      )}

      {/* Template Library panel (chat view only) */}
      <AnimatePresence>
        {currentView === 'chat' && showTemplates && (
          <TemplateLibrary isOpen={showTemplates} />
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 relative overflow-hidden bg-bg-app min-w-0">
        {currentView === 'chat' && !roomSession && (
          <ChatInterface
            onOpenSettings={() => setIsSettingsOpen(true)}
            autoOpenCamera={pendingCamera}
            onCameraAutoOpened={() => setPendingCamera(false)}
          />
        )}
        {currentView === 'chat' && roomSession && <RoomView />}
        {currentView === 'automation' && <FlowEditorWrapper />}
        {currentView === 'gallery' && (
          <Gallery onOpenCamera={() => { setCurrentView('chat'); setPendingCamera(true); }} />
        )}
      </div>

      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Deep-link join modal — shown when ?room= is in URL */}
      <AnimatePresence>
        {deepLinkRoomId && !roomSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-text-primary/30 backdrop-blur-[2px] p-4"
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="bg-bg-app border-2 border-glass-border shadow-[8px_8px_0px_var(--color-shadow-hard)] w-full max-w-sm overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b-2 border-glass-border">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-text-secondary" />
                  <h3 className="text-sm font-bold uppercase tracking-tight text-text-primary font-mono">
                    Dołącz do pokoju
                  </h3>
                </div>
                <button onClick={() => setDeepLinkRoomId(null)} className="text-text-secondary hover:text-text-primary transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Room name */}
              {deepLinkRoomName && (
                <div className="px-5 pt-4">
                  <p className="text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-0.5">Pokój</p>
                  <p className="text-base font-bold font-mono text-text-primary">{deepLinkRoomName}</p>
                </div>
              )}

              {/* Form */}
              <div className="px-5 py-4 flex flex-col gap-3">
                <div>
                  <label className="text-[9px] font-bold font-mono uppercase tracking-[0.15em] text-text-secondary block mb-1">
                    Twoja nazwa
                  </label>
                  <input
                    value={deepLinkUsername}
                    onChange={e => setDeepLinkUsername(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleDeepLinkJoin(); }}
                    placeholder="np. Mateusz"
                    autoFocus
                    className="w-full px-3 py-2 bg-transparent border-2 border-glass-border focus:border-text-primary text-[12px] font-mono text-text-primary placeholder:text-text-secondary/50 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold font-mono uppercase tracking-[0.15em] text-text-secondary block mb-1">
                    Hasło pokoju <span className="normal-case font-normal">(opcjonalne)</span>
                  </label>
                  <input
                    type="password"
                    value={deepLinkPassword}
                    onChange={e => setDeepLinkPassword(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleDeepLinkJoin(); }}
                    placeholder="pozostaw puste jeśli brak hasła"
                    className="w-full px-3 py-2 bg-transparent border-2 border-glass-border focus:border-text-primary text-[12px] font-mono text-text-primary placeholder:text-text-secondary/50 focus:outline-none transition-colors"
                  />
                </div>

                {deepLinkError && (
                  <p className="text-[10px] font-mono text-red-500">{deepLinkError}</p>
                )}

                <button
                  onClick={handleDeepLinkJoin}
                  disabled={!deepLinkUsername.trim() || deepLinkJoining}
                  className="w-full py-3 bg-text-primary text-bg-app border-2 border-text-primary text-[11px] font-bold font-mono uppercase tracking-widest shadow-[4px_4px_0px_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
                >
                  {deepLinkJoining ? <Loader2 size={13} className="animate-spin" /> : <Users size={13} />}
                  {deepLinkJoining ? 'Dołączam…' : 'Dołącz'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboarding wizard — shown once on first launch */}
      {showOnboarding && (
        <OnboardingWizard onDone={() => setShowOnboarding(false)} />
      )}

      {/* Theme Modal — full-screen overlay (Stitch design) */}
      <AnimatePresence>
        {showThemeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex flex-col justify-end bg-text-primary/20 backdrop-blur-[2px] p-4 pb-8"
            onClick={() => setShowThemeModal(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-bg-app border-2 border-glass-border shadow-[8px_8px_0px_var(--color-shadow-hard)] w-full max-w-sm mx-auto overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-4 border-b-2 border-glass-border">
                <h3 className="text-base font-bold uppercase tracking-tight text-text-primary font-mono">
                  Select Theme
                </h3>
                <button
                  onClick={() => setShowThemeModal(false)}
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Theme options */}
              <div className="p-4 space-y-3">
                {THEMES.map(({ value, label, Icon }) => {
                  const isActive = settings.theme === value;
                  return (
                    <button
                      key={value}
                      onClick={() => { updateSettings({ theme: value }); setShowThemeModal(false); }}
                      className={cn(
                        'w-full flex items-center justify-between px-5 py-4 border-2 font-bold uppercase text-sm tracking-widest font-mono transition-all duration-75',
                        'shadow-[4px_4px_0px_var(--color-shadow-hard)]',
                        'hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_var(--color-shadow-hard)]',
                        'active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
                        isActive
                          ? 'bg-text-primary text-bg-app border-text-primary'
                          : 'bg-bg-app text-text-primary border-glass-border hover:border-text-primary',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={16} />
                        {label}
                      </div>
                      {isActive
                        ? <Check size={16} />
                        : <div className="w-4 h-4 rounded-full border-2 border-current opacity-25" />
                      }
                    </button>
                  );
                })}
              </div>

              {/* Footer note */}
              <div className="px-5 pb-4 text-[9px] font-mono text-text-secondary/60 uppercase tracking-widest">
                Ink-System-v2.0 // Theme UI
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavButton({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'w-full aspect-square flex flex-col items-center justify-center gap-1 transition-all duration-150 border-2',
        active
          ? 'bg-text-primary text-bg-app border-text-primary shadow-[4px_4px_0px_rgba(0,0,0,0.15)]'
          : 'bg-transparent text-text-secondary border-transparent hover:border-glass-border hover:text-text-primary',
      )}
    >
      {icon}
      <span className="text-[9px] font-bold font-mono uppercase tracking-wider">{label}</span>
    </button>
  );
}
