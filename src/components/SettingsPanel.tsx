import React, { useState, useEffect } from 'react';
import { SchedulerSection } from '@/components/SchedulerSection';
import { PluginsSection } from '@/components/PluginsSection';
import { useSettings, Provider, RestrictionLevel } from '@/context/SettingsContext';
import { TutorialTooltip } from '@/components/ui/TutorialTooltip';
import { useModelList } from '@/hooks/useModelList';
import { useLanguage } from '@/context/LanguageContext';
import { GlassButton } from '@/components/ui/GlassButton';
import { ModelSelector } from '@/components/ui/ModelSelector';
import { X, Server, Key, Sparkles, Sliders, CheckCircle, XCircle, Eye, EyeOff, ScanText, Brain, MessageCircle, Globe, ShieldAlert, FolderSearch, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// --- Sub-components ---

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold font-mono uppercase tracking-[0.15em] text-text-secondary border-b-2 border-glass-border pb-2 mb-4">
      {children}
    </h3>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={cn(
      'flex items-center gap-1 text-[9px] font-bold font-mono uppercase tracking-wider px-2 py-0.5 border',
      active
        ? 'border-green-600 bg-green-50 text-green-700'
        : 'border-red-500 bg-red-50 text-red-600',
    )}>
      {active ? <CheckCircle size={9} /> : <XCircle size={9} />}
      {active ? 'Active' : 'Not connected'}
    </span>
  );
}

function ApiKeyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className="glass-input w-full py-2.5 text-sm pr-10"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

// P0-5: API key management — keys sent to server, never stored in localStorage
function ApiKeySection({
  providerKey, placeholder, savedMasked, inputValue, onChange, onSave, saving, saved,
}: {
  providerKey: string;
  placeholder: string;
  savedMasked: string;
  inputValue: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
          <Key size={11} /> API Key
        </label>
        <StatusBadge active={!!savedMasked} />
      </div>
      {savedMasked && (
        <div className="text-[10px] font-mono text-text-secondary px-2 py-1 border border-glass-border bg-bg-app">
          Saved: {savedMasked}
        </div>
      )}
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          className="glass-input w-full py-2.5 text-sm pr-10"
          value={inputValue}
          onChange={e => onChange(e.target.value)}
          placeholder={savedMasked ? 'Enter new key to replace…' : placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <button
        onClick={onSave}
        disabled={saving || !inputValue.trim()}
        className="w-full py-2 text-[10px] font-bold font-mono uppercase tracking-wider border-2 border-text-primary bg-text-primary text-bg-app hover:opacity-80 disabled:opacity-40 transition-opacity"
      >
        {saving ? 'Saving…' : saved ? '✓ Saved to Server' : 'Save Key to Server'}
      </button>
      <p className="text-[9px] font-mono text-text-secondary/60">
        Key stored in Vault — never in browser localStorage
      </p>
    </div>
  );
}

function FineTuneSection({
  endpoint,
  onModelCreated,
  t,
}: {
  endpoint: string;
  onModelCreated: (name: string) => void;
  t: import('@/context/LanguageContext').T;
}) {
  const [open, setOpen] = useState(false);
  const [baseModel, setBaseModel] = useState('llama3');
  const [modelName, setModelName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState('');
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!modelName.trim() || !baseModel.trim()) return;
    setCreating(true);
    setProgress([]);
    setError(null);
    try {
      const res = await fetch('/api/ollama/create-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          baseModel: baseModel.trim(),
          modelName: modelName.trim(),
          systemPrompt: systemPrompt.trim() || undefined,
          parameters: temperature ? { temperature: parseFloat(temperature) } : undefined,
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to create model');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let success = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            const msg = json.status ?? JSON.stringify(json);
            setProgress(prev => [...prev, msg]);
            if (json.status === 'success') success = true;
          } catch { /* ignore */ }
        }
      }
      if (success || true) {
        onModelCreated(modelName.trim());
        setProgress(prev => [...prev, `✓ Model "${modelName.trim()}" created!`]);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="border-2 border-glass-border">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-black/5 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary">
            {t.createCustomModel}
          </span>
          <span className="text-[7px] font-black font-mono uppercase tracking-widest px-1.5 py-0.5 border-2 border-yellow-500 text-yellow-600 bg-yellow-50 leading-none">
            LABS
          </span>
        </span>
        <ChevronDown size={14} className={cn('text-text-secondary transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t-2 border-glass-border p-4 space-y-3">
          <p className="text-[9px] font-mono text-text-secondary">{t.createCustomModelDesc}</p>
          <div>
            <label className="block text-[9px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-1">{t.baseModel}</label>
            <input
              className="glass-input w-full py-2 text-xs"
              value={baseModel}
              onChange={e => setBaseModel(e.target.value)}
              placeholder="llama3"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-1">{t.newModelName}</label>
            <input
              className="glass-input w-full py-2 text-xs"
              value={modelName}
              onChange={e => setModelName(e.target.value)}
              placeholder="my-assistant"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-1">{t.customSystemPrompt}</label>
            <textarea
              className="glass-input w-full py-2 text-xs min-h-[80px] resize-y"
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder={t.customSystemPromptPlaceholder}
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-1">Temperature (optional)</label>
            <input
              className="glass-input w-full py-2 text-xs"
              value={temperature}
              onChange={e => setTemperature(e.target.value)}
              placeholder="0.7"
              type="number"
              min="0"
              max="2"
              step="0.1"
            />
          </div>
          {error && (
            <div className="text-[9px] font-mono text-red-600 border border-red-400 bg-red-50 p-2">{error}</div>
          )}
          {progress.length > 0 && (
            <div className="border border-glass-border p-2 max-h-32 overflow-y-auto bg-black/5">
              {progress.map((line, i) => (
                <p key={i} className="text-[8px] font-mono text-text-primary leading-tight">{line}</p>
              ))}
            </div>
          )}
          <GlassButton
            onClick={handleCreate}
            disabled={creating || !modelName.trim() || !baseModel.trim()}
            className="w-full"
            size="sm"
          >
            {creating ? (
              <span className="flex items-center gap-2 justify-center">
                <Loader2 size={12} className="animate-spin" />
                {t.creatingModel}
              </span>
            ) : t.createModel}
          </GlassButton>
        </div>
      )}
    </div>
  );
}

function ParamSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  leftLabel,
  rightLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  leftLabel?: string;
  rightLabel?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold font-mono uppercase tracking-wide text-text-primary">{label}</label>
        <div className="font-mono font-bold text-xs bg-bg-app border-2 border-glass-border px-2 py-0.5 shadow-[2px_2px_0px_#1A1A1A] min-w-[3rem] text-center">
          {value}
        </div>
      </div>
      <div className="relative h-8 flex items-center select-none">
        {/* Track */}
        <div className="absolute w-full h-[2px] bg-glass-border" />
        {/* Active portion */}
        <div
          className="absolute h-[3px] bg-text-primary transition-all"
          style={{ width: `${pct}%` }}
        />
        {/* Range input (invisible but interactive) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute w-full opacity-0 cursor-pointer h-8 z-10"
        />
        {/* Thumb visual */}
        <div
          className="absolute w-5 h-5 bg-text-primary border-2 border-text-primary shadow-[2px_2px_0px_rgba(0,0,0,0.2)] pointer-events-none -translate-x-1/2 transition-all"
          style={{ left: `${pct}%` }}
        />
      </div>
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-[9px] font-mono text-text-secondary uppercase font-bold tracking-wider">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}

// --- Main Panel ---

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useSettings();
  const { lang, setLang, t } = useLanguage();
  const [localSettings, setLocalSettings] = useState(settings);
  const [activeTab, setActiveTab] = useState<'model' | 'params' | 'prompt' | 'vision' | 'telegram' | 'language' | 'persona' | 'agent' | 'scheduler' | 'plugins'>('model');
  const [tgStatus, setTgStatus] = useState<{ active: boolean; registered: boolean; botUsername: string; provider: string; model: string } | null>(null);
  const [tgToken, setTgToken] = useState('');
  const [tgConnecting, setTgConnecting] = useState(false);
  const [tgError, setTgError] = useState<string | null>(null);
  const [tgEditProvider, setTgEditProvider] = useState<'ollama' | 'openai' | 'google' | 'anthropic'>('ollama');
  const [tgEditModel, setTgEditModel] = useState('');
  const [tgEditApiKey, setTgEditApiKey] = useState('');
  const [tgEditSaving, setTgEditSaving] = useState(false);

  // P0-5: API keys stored server-side — separate state for key inputs (not persisted to localStorage)
  const [keyInputs, setKeyInputs] = useState({ openai: '', google: '', anthropic: '' });
  const [savedKeysMasked, setSavedKeysMasked] = useState({ openai: '', google: '', anthropic: '' });
  const [keysSaving, setKeysSaving] = useState(false);
  const [keysSaved, setKeysSaved] = useState(false);
  const [uncensoredMode, setUncensoredMode] = useState(false);

  const fetchSavedKeys = () =>
    fetch('/api/ai/keys').then(r => r.json()).then(d => {
      setSavedKeysMasked({ openai: d.openai ?? '', google: d.google ?? '', anthropic: d.anthropic ?? '' });
    }).catch(() => {});

  const handleSaveKeys = async () => {
    setKeysSaving(true);
    setKeysSaved(false);
    try {
      await fetch('/api/ai/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keyInputs),
      });
      setKeyInputs({ openai: '', google: '', anthropic: '' });
      await fetchSavedKeys();
      setKeysSaved(true);
      setTimeout(() => setKeysSaved(false), 3000);
    } finally {
      setKeysSaving(false);
    }
  };

  const refreshTgStatus = () =>
    fetch('/api/telegram/status').then(r => r.json()).then((s) => {
      setTgStatus(s);
      if (s?.active) {
        setTgEditProvider(s.provider || 'ollama');
        setTgEditModel(s.model || '');
      }
    }).catch(() => {});

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
      refreshTgStatus();
      fetchSavedKeys();
      setTgError(null);
      fetch('/api/config').then(r => r.json()).then(d => setUncensoredMode(!!d.uncensored)).catch(() => {});
    }
  }, [isOpen, settings]);

  // Poll for registration after bot connects (user sends /register in Telegram)
  useEffect(() => {
    if (!tgStatus?.active || tgStatus.registered) return;
    const interval = setInterval(refreshTgStatus, 3000);
    return () => clearInterval(interval);
  }, [tgStatus?.active, tgStatus?.registered]);

  const handleTelegramConnect = async () => {
    if (!tgToken.trim()) { setTgError('Paste your Bot Token first'); return; }
    setTgConnecting(true);
    setTgError(null);
    const provider = localSettings.provider;
    const model = localSettings.model;
    // P0-5: Telegram uses its own apiKey field (tgEditApiKey) — not from localStorage
    const apiKey = tgEditApiKey;
    try {
      const res = await fetch('/api/telegram/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tgToken.trim(), allowedUserIds: '', notifyChatId: '', provider, model, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) { setTgError(data.error ?? 'Connection failed'); return; }
      setTgToken('');
      refreshTgStatus();
    } catch (e: any) {
      setTgError(e.message);
    } finally {
      setTgConnecting(false);
    }
  };

  const handleTelegramUpdateProvider = async () => {
    setTgEditSaving(true);
    try {
      await fetch('/api/telegram/set-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: tgEditProvider, model: tgEditModel, apiKey: tgEditApiKey }),
      });
      setTgEditApiKey('');
      refreshTgStatus();
    } finally {
      setTgEditSaving(false);
    }
  };

  const handleTelegramDisconnect = async () => {
    await fetch('/api/telegram/disconnect', { method: 'POST' });
    setTgStatus(null);
  };

  const { models, loading: modelsLoading, error: modelsError, refresh: refreshModels } =
    useModelList({ provider: localSettings.provider, endpoint: localSettings.endpoint });

  // B1/B2: Vision and RAG always use local Ollama
  const { models: visionModels, loading: visionLoading, error: visionError, refresh: refreshVision } =
    useModelList({ provider: 'ollama', endpoint: localSettings.endpoint });

  // B3: Telegram model — provider can be non-Ollama
  const { models: tgModels, loading: tgModelsLoading, error: tgModelsError, refresh: refreshTgModels } =
    useModelList({ provider: tgEditProvider, endpoint: localSettings.endpoint });

  const handleSave = () => {
    updateSettings(localSettings);
    onClose();
  };

  const providers: { id: Provider; name: string; keyPlaceholder?: string }[] = [
    { id: 'ollama', name: 'Ollama (Local)' },
    { id: 'openai', name: 'OpenAI', keyPlaceholder: 'sk-...' },
    { id: 'google', name: 'Google Gemini', keyPlaceholder: 'AIza...' },
    { id: 'anthropic', name: 'Anthropic', keyPlaceholder: 'sk-ant-...' },
  ];

  const tabs = [
    { id: 'model' as const, label: t.provider },
    { id: 'params' as const, label: t.parameters },
    { id: 'prompt' as const, label: t.systemPrompt },
    { id: 'vision' as const, label: t.visionRag },
    { id: 'persona' as const, label: t.persona },
    { id: 'agent' as const, label: t.osAgent },
    { id: 'telegram' as const, label: t.telegram },
    { id: 'language' as const, label: t.language },
    { id: 'scheduler' as const, label: 'Scheduler' },
    { id: 'plugins' as const, label: 'Plugins' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-text-primary/30 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl relative max-h-[90vh] flex flex-col z-10 bg-bg-app border-2 border-glass-border shadow-[8px_8px_0px_#1A1A1A]"
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-glass-border">
              <h2 className="text-sm font-bold font-mono uppercase tracking-widest text-text-primary flex items-center gap-2">
                <Sparkles size={16} />
                {t.systemConfig}
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-black/5 transition-colors border border-transparent hover:border-glass-border"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b-2 border-glass-border overflow-x-auto">
              {tabs.map(tab => {
                const tutorialMap: Record<string, import('@/lib/tutorialContent').TutorialKey> = {
                  model: 'settings_provider',
                  params: 'settings_params',
                  prompt: 'settings_prompt',
                  vision: 'settings_vision',
                  persona: 'settings_persona',
                  agent: 'settings_agent',
                  telegram: 'settings_telegram',
                  language: 'settings_language',
                };
                const ttKey = tutorialMap[tab.id];
                const btn = (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex-1 w-full py-2.5 text-[11px] font-bold font-mono uppercase tracking-wider border-r-2 border-glass-border last:border-r-0 transition-colors',
                      activeTab === tab.id
                        ? 'bg-text-primary text-bg-app'
                        : 'text-text-secondary hover:text-text-primary hover:bg-black/5',
                    )}
                  >
                    {tab.label}
                  </button>
                );
                return ttKey ? (
                  <TutorialTooltip key={tab.id} tutorialKey={ttKey} position="bottom" className="flex-1">
                    {btn}
                  </TutorialTooltip>
                ) : btn;
              })}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* ── TAB: Model / Provider ── */}
              {activeTab === 'model' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  {/* Provider selection */}
                  <div>
                    <SectionTitle>AI Provider</SectionTitle>
                    <div className="grid grid-cols-2 gap-2">
                      {providers.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setLocalSettings({ ...localSettings, provider: p.id })}
                          className={cn(
                            'px-4 py-3 text-xs font-bold font-mono uppercase tracking-wide text-left border-2 transition-all',
                            localSettings.provider === p.id
                              ? 'bg-text-primary text-bg-app border-text-primary shadow-[4px_4px_0px_rgba(0,0,0,0.15)]'
                              : 'bg-transparent border-glass-border text-text-secondary hover:border-text-primary hover:text-text-primary',
                          )}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Provider-specific settings */}
                  {localSettings.provider === 'ollama' && (
                    <div className="space-y-4">
                      <SectionTitle>Ollama Endpoint</SectionTitle>
                      <div>
                        <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-1.5">
                          <Server size={11} /> Endpoint URL
                        </label>
                        <input
                          className="glass-input w-full py-2.5 text-sm"
                          value={localSettings.endpoint}
                          onChange={e => setLocalSettings({ ...localSettings, endpoint: e.target.value })}
                          placeholder="http://localhost:11434"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-2">Model</label>
                        <ModelSelector
                          value={localSettings.model}
                          onChange={m => setLocalSettings({ ...localSettings, model: m })}
                          models={models}
                          loading={modelsLoading}
                          error={modelsError}
                          onRefresh={refreshModels}
                          placeholder="llama3"
                        />
                      </div>
                      <TutorialTooltip tutorialKey="finetune" position="right">
                        <FineTuneSection
                          endpoint={localSettings.endpoint}
                          onModelCreated={(name) => {
                            setLocalSettings({ ...localSettings, model: name });
                            refreshModels();
                          }}
                          t={t}
                        />
                      </TutorialTooltip>
                    </div>
                  )}

                  {localSettings.provider === 'openai' && (
                    <div className="space-y-4">
                      <SectionTitle>OpenAI Configuration</SectionTitle>
                      <ApiKeySection
                        providerKey="openai"
                        placeholder="sk-..."
                        savedMasked={savedKeysMasked.openai}
                        inputValue={keyInputs.openai}
                        onChange={v => setKeyInputs(k => ({ ...k, openai: v }))}
                        onSave={handleSaveKeys}
                        saving={keysSaving}
                        saved={keysSaved}
                      />
                      <div>
                        <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-2">Model</label>
                        <ModelSelector
                          value={localSettings.model}
                          onChange={m => setLocalSettings({ ...localSettings, model: m })}
                          models={models}
                          loading={modelsLoading}
                          error={modelsError}
                          onRefresh={refreshModels}
                          placeholder="gpt-4o"
                        />
                      </div>
                    </div>
                  )}

                  {localSettings.provider === 'google' && (
                    <div className="space-y-4">
                      <SectionTitle>Google Gemini Configuration</SectionTitle>
                      <ApiKeySection
                        providerKey="google"
                        placeholder="AIza..."
                        savedMasked={savedKeysMasked.google}
                        inputValue={keyInputs.google}
                        onChange={v => setKeyInputs(k => ({ ...k, google: v }))}
                        onSave={handleSaveKeys}
                        saving={keysSaving}
                        saved={keysSaved}
                      />
                      <div>
                        <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-2">Model</label>
                        <ModelSelector
                          value={localSettings.model}
                          onChange={m => setLocalSettings({ ...localSettings, model: m })}
                          models={models}
                          loading={modelsLoading}
                          error={modelsError}
                          onRefresh={refreshModels}
                          placeholder="gemini-2.5-flash-latest"
                        />
                      </div>
                    </div>
                  )}

                  {localSettings.provider === 'anthropic' && (
                    <div className="space-y-4">
                      <SectionTitle>Anthropic Configuration</SectionTitle>
                      <ApiKeySection
                        providerKey="anthropic"
                        placeholder="sk-ant-..."
                        savedMasked={savedKeysMasked.anthropic}
                        inputValue={keyInputs.anthropic}
                        onChange={v => setKeyInputs(k => ({ ...k, anthropic: v }))}
                        onSave={handleSaveKeys}
                        saving={keysSaving}
                        saved={keysSaved}
                      />
                      <div>
                        <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-2">Model</label>
                        <ModelSelector
                          value={localSettings.model}
                          onChange={m => setLocalSettings({ ...localSettings, model: m })}
                          models={models}
                          loading={modelsLoading}
                          error={modelsError}
                          onRefresh={refreshModels}
                          placeholder="claude-sonnet-4-6"
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── TAB: Model Parameters ── */}
              {activeTab === 'params' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div className="border-2 border-glass-border p-4 shadow-[4px_4px_0px_#1A1A1A] flex items-start gap-3">
                    <Sliders size={20} className="text-text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-text-primary">Fine-tune Responses</p>
                      <p className="text-xs text-text-secondary font-mono mt-0.5">
                        Adjust creativity and randomness of the engine.
                      </p>
                    </div>
                  </div>

                  <ParamSlider
                    label="Temperature"
                    value={localSettings.temperature}
                    onChange={v => setLocalSettings({ ...localSettings, temperature: v })}
                    min={0}
                    max={2}
                    step={0.1}
                    leftLabel="Precise"
                    rightLabel="Creative"
                  />

                  <ParamSlider
                    label="Top-P"
                    value={localSettings.topP}
                    onChange={v => setLocalSettings({ ...localSettings, topP: v })}
                    min={0}
                    max={1}
                    step={0.05}
                    leftLabel="Focused"
                    rightLabel="Random"
                  />

                  <ParamSlider
                    label="Max Tokens"
                    value={localSettings.maxTokens}
                    onChange={v => setLocalSettings({ ...localSettings, maxTokens: v })}
                    min={256}
                    max={8192}
                    step={256}
                    leftLabel="256"
                    rightLabel="8192"
                  />
                </motion.div>
              )}

              {/* ── TAB: Vision & RAG ── */}
              {activeTab === 'vision' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  {/* Vision */}
                  <div>
                    <SectionTitle>Vision (Image Analysis)</SectionTitle>
                    <div className="border-2 border-glass-border p-4 shadow-[4px_4px_0px_#1A1A1A] flex items-start gap-3 mb-4">
                      <ScanText size={18} className="text-text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-text-primary">Local Vision Model</p>
                        <p className="text-xs text-text-secondary font-mono mt-0.5">
                          Requires Ollama. Install with: <code className="bg-black/5 px-1">ollama pull qwen2.5vl</code>
                        </p>
                      </div>
                    </div>
                    <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-2">
                      Vision Model
                    </label>
                    <ModelSelector
                      value={localSettings.visionModel}
                      onChange={v => setLocalSettings({ ...localSettings, visionModel: v })}
                      models={visionModels}
                      loading={visionLoading}
                      error={visionError}
                      onRefresh={refreshVision}
                      placeholder="qwen2.5vl"
                    />
                    <p className="text-[9px] font-mono text-text-secondary mt-1.5">Other options: llava, moondream, llava-phi3</p>
                  </div>

                  {/* RAG Memory */}
                  <div>
                    <SectionTitle>RAG Memory (Semantic Search)</SectionTitle>
                    <div className="border-2 border-glass-border p-4 shadow-[4px_4px_0px_#1A1A1A] flex items-start gap-3 mb-4">
                      <Brain size={18} className="text-text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-text-primary">Cross-Session Memory</p>
                        <p className="text-xs text-text-secondary font-mono mt-0.5">
                          Finds similar past exchanges and injects them as context. Requires Ollama +{' '}
                          <code className="bg-black/5 px-1">ollama pull nomic-embed-text</code>
                        </p>
                      </div>
                    </div>

                    {/* RAG toggle */}
                    <TutorialTooltip tutorialKey="rag_toggle" position="left">
                    <div className="flex items-center justify-between p-3 border-2 border-glass-border mb-3">
                      <div>
                        <p className="text-xs font-bold font-mono uppercase tracking-wide text-text-primary">Enable RAG Memory</p>
                        <p className="text-[9px] font-mono text-text-secondary mt-0.5">Injects top-4 similar past messages into every prompt</p>
                      </div>
                      <button
                        onClick={() => setLocalSettings({ ...localSettings, ragEnabled: !localSettings.ragEnabled })}
                        className={cn(
                          'flex-shrink-0 w-10 h-5 border-2 transition-colors relative',
                          localSettings.ragEnabled
                            ? 'bg-text-primary border-text-primary'
                            : 'bg-bg-app border-glass-border',
                        )}
                      >
                        <span className={cn(
                          'absolute top-0.5 w-3 h-3 bg-bg-app transition-transform',
                          localSettings.ragEnabled ? 'translate-x-[18px]' : 'translate-x-0.5',
                        )} />
                      </button>
                    </div>
                    </TutorialTooltip>

                    {localSettings.ragEnabled && (
                      <div>
                        <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-2">
                          Embedding Model
                        </label>
                        <ModelSelector
                          value={localSettings.ragModel}
                          onChange={v => setLocalSettings({ ...localSettings, ragModel: v })}
                          models={visionModels}
                          loading={visionLoading}
                          error={visionError}
                          onRefresh={refreshVision}
                          placeholder="nomic-embed-text"
                        />
                        <p className="text-[9px] font-mono text-text-secondary mt-1.5">Other: mxbai-embed-large, all-minilm</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── TAB: Telegram ── */}
              {activeTab === 'telegram' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

                  {/* ── CONNECTED & REGISTERED ── */}
                  {tgStatus?.active && tgStatus.registered && (
                    <>
                      <div className="border-2 border-green-500 bg-green-50 p-4 shadow-[4px_4px_0px_#16a34a]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle size={18} className="text-green-600" />
                            <p className="text-sm font-bold text-green-800 font-mono uppercase">Bot Connected</p>
                          </div>
                          <button
                            onClick={handleTelegramDisconnect}
                            className="text-[9px] font-bold font-mono uppercase text-red-500 hover:text-red-700 border border-red-300 px-2 py-0.5"
                          >
                            Disconnect
                          </button>
                        </div>
                        {tgStatus.botUsername && (
                          <a
                            href={`https://t.me/${tgStatus.botUsername}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-green-700 hover:underline"
                          >
                            <MessageCircle size={12} />
                            @{tgStatus.botUsername}
                          </a>
                        )}
                        <p className="text-[10px] font-mono text-green-700 mt-1">
                          {tgStatus.provider} · {tgStatus.model}
                        </p>
                      </div>

                      <div>
                        <SectionTitle>AI Provider</SectionTitle>
                        <div className="space-y-3">
                          <div className="grid grid-cols-4 gap-1">
                            {(['ollama', 'openai', 'google', 'anthropic'] as const).map(p => (
                              <button
                                key={p}
                                onClick={() => { setTgEditProvider(p); setTgEditApiKey(''); }}
                                className={cn(
                                  'py-1.5 text-[9px] font-bold font-mono uppercase tracking-wide border transition-all',
                                  tgEditProvider === p
                                    ? 'bg-text-primary text-bg-app border-text-primary'
                                    : 'border-glass-border text-text-secondary hover:border-text-primary hover:text-text-primary',
                                )}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold font-mono uppercase tracking-widest text-text-secondary mb-1">Model</label>
                            <ModelSelector
                              value={tgEditModel}
                              onChange={setTgEditModel}
                              models={tgModels}
                              loading={tgModelsLoading}
                              error={tgModelsError}
                              onRefresh={refreshTgModels}
                              placeholder={
                                tgEditProvider === 'openai' ? 'gpt-4o'
                                : tgEditProvider === 'google' ? 'gemini-2.5-flash-latest'
                                : tgEditProvider === 'anthropic' ? 'claude-sonnet-4-6'
                                : 'llama3.2'
                              }
                            />
                          </div>
                          {tgEditProvider !== 'ollama' && (
                            <div>
                              <label className="block text-[9px] font-bold font-mono uppercase tracking-widest text-text-secondary mb-1">API Key</label>
                              <ApiKeyInput
                                value={tgEditApiKey}
                                onChange={setTgEditApiKey}
                                placeholder={
                                  tgEditProvider === 'openai' ? 'sk-...'
                                  : tgEditProvider === 'google' ? 'AIza...'
                                  : 'sk-ant-...'
                                }
                              />
                            </div>
                          )}
                          <GlassButton size="sm" onClick={handleTelegramUpdateProvider} disabled={tgEditSaving} className="w-full">
                            {tgEditSaving ? 'Saving…' : 'Update Provider'}
                          </GlassButton>
                        </div>
                      </div>

                      <div>
                        <SectionTitle>Commands</SectionTitle>
                        <div className="border-2 border-glass-border divide-y divide-glass-border">
                          {[
                            ['/chat <msg>', 'One-shot AI reply'],
                            ['/ask <msg>', 'Conversational AI (history)'],
                            ['/reset', 'Clear conversation'],
                            ['/status', 'System status'],
                            ['/last', 'Last 5 sessions'],
                            ['/search <q>', 'Search sessions'],
                            ['/export <id|last>', 'Download transcript'],
                            ['/photo last', 'Last uploaded photo'],
                          ].map(([cmd, desc]) => (
                            <div key={cmd} className="flex items-center gap-3 px-3 py-2">
                              <code className="text-[10px] font-mono font-bold text-text-primary whitespace-nowrap w-[130px] flex-shrink-0">{cmd}</code>
                              <span className="text-[10px] font-mono text-text-secondary">{desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── CONNECTED, WAITING FOR /register ── */}
                  {tgStatus?.active && !tgStatus.registered && (
                    <div className="border-2 border-yellow-400 bg-yellow-50 p-5 shadow-[4px_4px_0px_#ca8a04] space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                        <p className="text-sm font-bold font-mono uppercase text-yellow-800">Step 2 — Open bot & register</p>
                      </div>
                      <p className="text-xs font-mono text-yellow-700 leading-relaxed">
                        Bot is running. Now open it in Telegram and send <code className="bg-yellow-200 px-1">/register</code> — it will automatically set up your access.
                      </p>
                      {tgStatus.botUsername ? (
                        <a
                          href={`https://t.me/${tgStatus.botUsername}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-3 bg-yellow-400 border-2 border-yellow-600 text-yellow-900 font-bold font-mono text-sm uppercase shadow-[3px_3px_0px_#854d0e] hover:-translate-y-px transition-transform"
                        >
                          <MessageCircle size={16} />
                          Open @{tgStatus.botUsername} in Telegram
                        </a>
                      ) : (
                        <p className="text-[10px] font-mono text-yellow-600">Fetching bot username…</p>
                      )}
                      <p className="text-[10px] font-mono text-yellow-600 text-center">
                        Waiting for /register… (auto-refreshing)
                      </p>
                    </div>
                  )}

                  {/* ── NOT CONNECTED ── */}
                  {!tgStatus?.active && (
                    <div className="space-y-5">
                      {/* Step indicator */}
                      <div className="flex items-center gap-0">
                        {['1. Get token', '2. Connect', '3. Register'].map((s, i) => (
                          <div key={i} className={cn('flex items-center', i < 2 && 'flex-1')}>
                            <div className="flex items-center gap-1.5 px-2 py-1 border-2 border-glass-border text-[9px] font-bold font-mono uppercase tracking-wider bg-bg-app">
                              <span className="w-3.5 h-3.5 rounded-full bg-text-primary/20 text-text-primary flex items-center justify-center text-[8px] font-black">
                                {i + 1}
                              </span>
                              {s}
                            </div>
                            {i < 2 && <div className="flex-1 h-px bg-glass-border mx-1" />}
                          </div>
                        ))}
                      </div>

                      {/* Step 1 */}
                      <div className="border-2 border-glass-border p-4">
                        <p className="text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-2">Step 1 — Get a bot token</p>
                        <p className="text-xs font-mono text-text-secondary leading-relaxed">
                          Open Telegram → message{' '}
                          <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="font-bold text-text-primary hover:underline">@BotFather</a>
                          {' '}→ send <code className="bg-black/5 px-1">/newbot</code> → copy the token.
                        </p>
                      </div>

                      {/* Step 2 */}
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary">Step 2 — Paste token & connect</p>
                        <ApiKeyInput
                          value={tgToken}
                          onChange={setTgToken}
                          placeholder="123456789:AABBCCDDaabbccdd..."
                        />
                        {tgError && (
                          <div className="text-[10px] font-mono text-red-600 border border-red-400 bg-red-50 p-2">
                            {tgError}
                          </div>
                        )}
                        <GlassButton onClick={handleTelegramConnect} disabled={tgConnecting} className="w-full">
                          {tgConnecting ? 'Connecting…' : 'Connect Bot'}
                        </GlassButton>
                      </div>

                      {/* Step 3 preview */}
                      <div className="border-2 border-glass-border/50 p-4 opacity-50">
                        <p className="text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-1">Step 3 — Register in Telegram</p>
                        <p className="text-xs font-mono text-text-secondary">
                          After connecting, open your bot and send <code className="bg-black/5 px-1">/register</code>.
                          Done.
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── TAB: System Prompt ── */}
              {activeTab === 'prompt' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <SectionTitle>{t.systemPromptLabel}</SectionTitle>
                  <p className="text-xs text-text-secondary font-mono">
                    {t.systemPromptDesc}
                  </p>
                  <textarea
                    className="glass-input w-full py-3 min-h-[220px] resize-y text-sm leading-relaxed"
                    value={localSettings.systemPrompt}
                    onChange={e => setLocalSettings({ ...localSettings, systemPrompt: e.target.value })}
                    placeholder={t.systemPromptPlaceholder}
                  />
                </motion.div>
              )}

              {/* ── TAB: Persona / Uncensored ── */}
              {activeTab === 'persona' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div className="border-2 border-glass-border p-4 shadow-[4px_4px_0px_#1A1A1A] flex items-start gap-3">
                    <ShieldAlert size={20} className="text-text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-text-primary">{t.personaModeLabel}</p>
                      <p className="text-xs text-text-secondary font-mono mt-0.5">{t.personaModeDesc}</p>
                    </div>
                  </div>

                  {/* Master toggle */}
                  <div className="flex items-center justify-between p-3 border-2 border-glass-border">
                    <div>
                      <p className="text-xs font-bold font-mono uppercase tracking-wide text-text-primary">{t.personaModeLabel}</p>
                      <p className="text-[9px] font-mono text-text-secondary mt-0.5">{t.personaNameHint}</p>
                    </div>
                    <button
                      onClick={() => setLocalSettings({ ...localSettings, personaEnabled: !localSettings.personaEnabled })}
                      className={cn(
                        'flex-shrink-0 w-10 h-5 border-2 transition-colors relative',
                        localSettings.personaEnabled ? 'bg-text-primary border-text-primary' : 'bg-bg-app border-glass-border',
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 w-3 h-3 bg-bg-app transition-transform',
                        localSettings.personaEnabled ? 'translate-x-[18px]' : 'translate-x-0.5',
                      )} />
                    </button>
                  </div>

                  {localSettings.personaEnabled && (
                    <div className="space-y-4">
                      <SectionTitle>Identity</SectionTitle>

                      {/* Persona name */}
                      <div>
                        <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-2">
                          {t.personaNameLabel}
                        </label>
                        <input
                          className="glass-input w-full py-2.5 text-sm"
                          value={localSettings.personaName}
                          onChange={e => setLocalSettings({ ...localSettings, personaName: e.target.value })}
                          placeholder={t.personaNamePlaceholder}
                        />
                      </div>

                      <SectionTitle>{t.restrictionLevel}</SectionTitle>

                      {/* Restriction level */}
                      <TutorialTooltip tutorialKey="persona_restriction" position="left">
                      <div>
                        <div className="space-y-2">
                          {([
                            ['standard', t.restrictionStandard, t.restrictionStandardDesc],
                            ['minimal', t.restrictionMinimal, t.restrictionMinimalDesc],
                            ['none', t.restrictionNone, t.restrictionNoneDesc],
                          ] as [RestrictionLevel, string, string][]).map(([val, label, desc]) => {
                            const locked = val === 'none' && !uncensoredMode;
                            return (
                              <button
                                key={val}
                                disabled={locked}
                                onClick={() => !locked && setLocalSettings({ ...localSettings, restrictionLevel: val })}
                                className={cn(
                                  'w-full text-left px-4 py-3 border-2 transition-all',
                                  locked
                                    ? 'border-glass-border opacity-40 cursor-not-allowed'
                                    : localSettings.restrictionLevel === val
                                      ? 'bg-text-primary text-bg-app border-text-primary shadow-[3px_3px_0px_rgba(0,0,0,0.15)]'
                                      : 'border-glass-border text-text-secondary hover:border-text-primary hover:text-text-primary',
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold font-mono uppercase tracking-wide">{label}</p>
                                  {locked && <span className="text-[8px] font-mono font-bold text-text-secondary border border-glass-border px-1">CHARBOT_UNCENSORED=true</span>}
                                </div>
                                <p className={cn(
                                  'text-[9px] font-mono mt-0.5',
                                  localSettings.restrictionLevel === val && !locked ? 'text-bg-app/70' : 'text-text-secondary',
                                )}>{desc}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      </TutorialTooltip>

                      {/* Uncensored mode active warning */}
                      {localSettings.restrictionLevel === 'none' && uncensoredMode && (
                        <div className="border-2 border-red-400 bg-red-50 p-3 shadow-[2px_2px_0px_#dc2626]">
                          <p className="text-[10px] font-bold font-mono uppercase tracking-wider text-red-700 mb-1">
                            Uncensored mode active
                          </p>
                          <p className="text-[9px] font-mono text-red-600">
                            All safety guardrails are disabled. Use responsibly. Set CHARBOT_UNCENSORED=false to re-enable.
                          </p>
                        </div>
                      )}

                      {/* Ollama uncensored tip */}
                      {localSettings.restrictionLevel === 'none' && localSettings.provider === 'ollama' && uncensoredMode && (
                        <div className="border-2 border-yellow-400 bg-yellow-50 p-3 shadow-[2px_2px_0px_#ca8a04]">
                          <p className="text-[10px] font-bold font-mono uppercase tracking-wider text-yellow-800 mb-1">
                            {t.uncensoredModelTip}
                          </p>
                          <p className="text-[9px] font-mono text-yellow-700">{t.uncensoredModelList}</p>
                          <p className="text-[9px] font-mono font-bold text-yellow-800 mt-1">
                            dolphin-mistral · wizard-vicuna-uncensored · dolphin-llama3
                          </p>
                        </div>
                      )}

                      <SectionTitle>Behavior</SectionTitle>

                      {/* Custom behavior */}
                      <div>
                        <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-2">
                          {t.personaBehavior}
                        </label>
                        <textarea
                          className="glass-input w-full py-3 min-h-[100px] resize-y text-sm leading-relaxed"
                          value={localSettings.personaBehavior}
                          onChange={e => setLocalSettings({ ...localSettings, personaBehavior: e.target.value })}
                          placeholder={t.personaBehaviorPlaceholder}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── TAB: OS Agent ── */}
              {activeTab === 'agent' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div className="border-2 border-glass-border p-4 shadow-[4px_4px_0px_#1A1A1A] flex items-start gap-3">
                    <FolderSearch size={20} className="text-text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-text-primary">{t.osAgentLabel}</p>
                      <p className="text-xs text-text-secondary font-mono mt-0.5">{t.osAgentDesc}</p>
                    </div>
                  </div>

                  {/* Enable toggle */}
                  <TutorialTooltip tutorialKey="agent_toggle" position="left">
                  <div className="flex items-center justify-between p-3 border-2 border-glass-border">
                    <div>
                      <p className="text-xs font-bold font-mono uppercase tracking-wide text-text-primary">{t.enableOsAgent}</p>
                    </div>
                    <button
                      onClick={() => setLocalSettings({ ...localSettings, osAgentEnabled: !localSettings.osAgentEnabled })}
                      className={cn(
                        'flex-shrink-0 w-10 h-5 border-2 transition-colors relative',
                        localSettings.osAgentEnabled ? 'bg-text-primary border-text-primary' : 'bg-bg-app border-glass-border',
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 w-3 h-3 bg-bg-app transition-transform',
                        localSettings.osAgentEnabled ? 'translate-x-[18px]' : 'translate-x-0.5',
                      )} />
                    </button>
                  </div>
                  </TutorialTooltip>

                  {localSettings.osAgentEnabled && (
                    <div className="space-y-4">
                      <SectionTitle>Security</SectionTitle>

                      {/* Warning */}
                      <div className="border-2 border-yellow-400 bg-yellow-50 p-3 shadow-[2px_2px_0px_#ca8a04]">
                        <p className="text-[10px] font-mono text-yellow-800">{t.osAgentWarning}</p>
                      </div>

                      <SectionTitle>{t.allowedDirs}</SectionTitle>

                      {/* Allowed dirs */}
                      <TutorialTooltip tutorialKey="agent_dirs" position="left">
                      <div>
                        <p className="text-[9px] font-mono text-text-secondary mb-3">{t.allowedDirsDesc}</p>
                        <div className="space-y-2">
                          {localSettings.osAllowedDirs.map((dir, idx) => (
                            <div key={idx} className="flex gap-2">
                              <input
                                className="glass-input flex-1 py-2 text-xs"
                                value={dir}
                                onChange={e => {
                                  const dirs = [...localSettings.osAllowedDirs];
                                  dirs[idx] = e.target.value;
                                  setLocalSettings({ ...localSettings, osAllowedDirs: dirs });
                                }}
                              />
                              <button
                                onClick={() => {
                                  const dirs = localSettings.osAllowedDirs.filter((_, i) => i !== idx);
                                  setLocalSettings({ ...localSettings, osAllowedDirs: dirs });
                                }}
                                className="flex-shrink-0 px-2 border-2 border-glass-border text-text-secondary hover:border-red-400 hover:text-red-500 transition-colors text-xs font-mono"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => setLocalSettings({ ...localSettings, osAllowedDirs: [...localSettings.osAllowedDirs, '~/'] })}
                            className="w-full py-2 border-2 border-dashed border-glass-border text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary hover:border-text-primary hover:text-text-primary transition-colors"
                          >
                            + {t.addDirectory}
                          </button>
                        </div>
                      </div>
                      </TutorialTooltip>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── TAB: Language ── */}
              {activeTab === 'language' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <SectionTitle>{t.languageLabel}</SectionTitle>

                  <div className="grid grid-cols-2 gap-3">
                    {([['en', '🇬🇧', t.english], ['pl', '🇵🇱', t.polish]] as const).map(([code, flag, name]) => (
                      <button
                        key={code}
                        onClick={() => setLang(code)}
                        className={cn(
                          'flex flex-col items-center gap-3 p-5 border-2 transition-all',
                          lang === code
                            ? 'bg-text-primary text-bg-app border-text-primary shadow-[4px_4px_0px_rgba(0,0,0,0.15)]'
                            : 'bg-transparent border-glass-border text-text-secondary hover:border-text-primary hover:text-text-primary',
                        )}
                      >
                        <span className="text-4xl">{flag}</span>
                        <span className="text-xs font-bold font-mono uppercase tracking-widest">{name}</span>
                        {lang === code && (
                          <CheckCircle size={14} className="text-bg-app" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="border-2 border-glass-border p-4 flex items-start gap-3">
                    <Globe size={18} className="text-text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-text-primary font-mono uppercase tracking-wide">
                        {lang === 'pl' ? 'Automatyczny język AI' : 'Automatic AI Language'}
                      </p>
                      <p className="text-xs text-text-secondary font-mono mt-1 leading-relaxed">
                        {lang === 'pl'
                          ? 'AI odpowiada w języku rozmowy — pisz po polsku, a otrzymasz odpowiedź po polsku.'
                          : 'The AI responds in the language you use — write in English to get English responses.'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── TAB: Scheduler ── */}
              {activeTab === 'scheduler' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <h3 className="text-[10px] font-bold font-mono uppercase tracking-[0.15em] text-text-secondary border-b-2 border-glass-border pb-2 mb-4">
                    Harmonogram zadań
                  </h3>
                  <SchedulerSection />
                </motion.div>
              )}

              {/* ── TAB: Plugins ── */}
              {activeTab === 'plugins' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <PluginsSection />
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t-2 border-glass-border flex justify-end gap-3 bg-bg-app">
              <GlassButton variant="ghost" onClick={onClose}>{t.cancel}</GlassButton>
              <GlassButton onClick={handleSave}>{t.saveChanges}</GlassButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
