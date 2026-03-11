import React, { useState } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { cn } from '@/lib/utils';
import { ChevronRight, CheckCircle, Server, Cloud, Zap, FolderOpen, MessageSquare } from 'lucide-react';

const STORAGE_KEY = 'charbot-onboarding-done';

export function isOnboardingDone(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

interface Props {
  onDone: () => void;
}

type Step = 'welcome' | 'provider' | 'done';

const PROVIDERS = [
  { id: 'ollama' as const, label: 'Ollama', desc: 'Local — runs on your machine. Private & free.', Icon: Server },
  { id: 'openai' as const, label: 'OpenAI', desc: 'Cloud — GPT-4o, o3 and more. Requires API key.', Icon: Cloud },
  { id: 'google' as const, label: 'Google', desc: 'Cloud — Gemini 2.0. Requires API key.', Icon: Cloud },
  { id: 'anthropic' as const, label: 'Anthropic', desc: 'Cloud — Claude 4. Requires API key.', Icon: Cloud },
] as const;

export function OnboardingWizard({ onDone }: Props) {
  const { settings, updateSettings } = useSettings();
  const [step, setStep] = useState<Step>('welcome');
  const [ollamaEndpoint, setOllamaEndpoint] = useState(settings.endpoint || 'http://localhost:11434');
  const [ollamaStatus, setOllamaStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [selectedProvider, setSelectedProvider] = useState(settings.provider);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onDone();
  };

  const testOllama = async () => {
    setOllamaStatus('checking');
    try {
      const res = await fetch(`${ollamaEndpoint}/api/version`, { signal: AbortSignal.timeout(3000) });
      setOllamaStatus(res.ok ? 'ok' : 'fail');
    } catch {
      setOllamaStatus('fail');
    }
  };

  const goProvider = () => {
    setStep('provider');
  };

  const goDone = () => {
    updateSettings({ provider: selectedProvider, endpoint: ollamaEndpoint });
    setStep('done');
  };

  return (
    <div className="fixed inset-0 z-[200] bg-bg-app flex items-center justify-center p-4">
      {/* Step indicator */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {(['welcome', 'provider', 'done'] as Step[]).map((s, i) => (
          <React.Fragment key={s}>
            <div className={cn(
              'w-2 h-2 border-2 transition-colors',
              step === s ? 'bg-text-primary border-text-primary' : 'bg-transparent border-glass-border',
            )} />
            {i < 2 && <div className="w-6 h-px bg-glass-border" />}
          </React.Fragment>
        ))}
      </div>

      <div className="w-full max-w-md border-2 border-text-primary shadow-[8px_8px_0px_var(--color-shadow-hard)] bg-bg-app">

        {/* ── STEP 1: WELCOME ── */}
        {step === 'welcome' && (
          <div>
            <div className="border-b-2 border-glass-border px-6 py-5">
              <p className="text-[9px] font-bold font-mono uppercase tracking-[0.2em] text-text-secondary mb-1">Step 1 of 3</p>
              <h1 className="text-xl font-black uppercase tracking-tight">Welcome to Charbot OS</h1>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm font-serif text-text-secondary leading-relaxed">
                A brutalist AI workspace that runs locally. Your data stays on your machine.
              </p>
              <div className="border-2 border-glass-border p-4 space-y-3">
                {[
                  { Icon: MessageSquare, text: 'Chat with any AI model — local or cloud' },
                  { Icon: FolderOpen, text: 'Files & sessions stored in ~/CharbotVault' },
                  { Icon: Zap, text: 'Automation flows, OS file agent, personas' },
                ].map(({ Icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <Icon size={14} className="text-text-secondary flex-shrink-0" />
                    <span className="text-[11px] font-mono text-text-primary">{text}</span>
                  </div>
                ))}
              </div>
              <div className="bg-text-primary/5 border border-glass-border px-4 py-2">
                <p className="text-[9px] font-mono text-text-secondary uppercase tracking-wider">Vault location</p>
                <p className="text-[11px] font-mono text-text-primary mt-0.5">~/CharbotVault</p>
              </div>
            </div>
            <div className="px-6 pb-5">
              <button
                onClick={goProvider}
                className="w-full flex items-center justify-center gap-2 py-3 bg-text-primary text-bg-app text-[11px] font-bold font-mono uppercase tracking-wider border-2 border-text-primary shadow-[4px_4px_0px_var(--color-shadow-hard)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Choose AI Provider <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: PROVIDER ── */}
        {step === 'provider' && (
          <div>
            <div className="border-b-2 border-glass-border px-6 py-5">
              <p className="text-[9px] font-bold font-mono uppercase tracking-[0.2em] text-text-secondary mb-1">Step 2 of 3</p>
              <h1 className="text-xl font-black uppercase tracking-tight">Choose AI Provider</h1>
            </div>
            <div className="px-6 py-5 space-y-2">
              {PROVIDERS.map(({ id, label, desc, Icon }) => (
                <button
                  key={id}
                  onClick={() => setSelectedProvider(id)}
                  className={cn(
                    'w-full flex items-start gap-3 px-4 py-3 border-2 text-left transition-all',
                    selectedProvider === id
                      ? 'border-text-primary bg-text-primary text-bg-app'
                      : 'border-glass-border hover:border-text-primary text-text-primary',
                  )}
                >
                  <Icon size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold font-mono uppercase tracking-wide">{label}</p>
                    <p className={cn('text-[10px] font-mono mt-0.5', selectedProvider === id ? 'text-bg-app/70' : 'text-text-secondary')}>
                      {desc}
                    </p>
                  </div>
                  {selectedProvider === id && <CheckCircle size={13} className="ml-auto flex-shrink-0 mt-0.5" />}
                </button>
              ))}

              {/* Ollama connection test */}
              {selectedProvider === 'ollama' && (
                <div className="border-2 border-glass-border p-3 mt-2 space-y-2">
                  <p className="text-[9px] font-bold font-mono uppercase tracking-wider text-text-secondary">Ollama Endpoint</p>
                  <div className="flex gap-2">
                    <input
                      value={ollamaEndpoint}
                      onChange={e => { setOllamaEndpoint(e.target.value); setOllamaStatus('idle'); }}
                      className="flex-1 glass-input text-[11px] py-1.5"
                      placeholder="http://localhost:11434"
                    />
                    <button
                      onClick={testOllama}
                      disabled={ollamaStatus === 'checking'}
                      className="px-3 py-1.5 border-2 border-text-primary text-[10px] font-bold font-mono uppercase hover:bg-text-primary hover:text-bg-app transition-colors disabled:opacity-50"
                    >
                      {ollamaStatus === 'checking' ? '…' : 'Test'}
                    </button>
                  </div>
                  {ollamaStatus === 'ok' && <p className="text-[10px] font-mono text-green-600">✓ Ollama is running</p>}
                  {ollamaStatus === 'fail' && <p className="text-[10px] font-mono text-red-500">✕ Cannot connect — run: ollama serve</p>}
                </div>
              )}

              {selectedProvider !== 'ollama' && (
                <p className="text-[10px] font-mono text-text-secondary border border-glass-border px-3 py-2 mt-1">
                  API key can be added in Settings → Model after setup.
                </p>
              )}
            </div>
            <div className="px-6 pb-5">
              <button
                onClick={goDone}
                className="w-full flex items-center justify-center gap-2 py-3 bg-text-primary text-bg-app text-[11px] font-bold font-mono uppercase tracking-wider border-2 border-text-primary shadow-[4px_4px_0px_var(--color-shadow-hard)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Continue <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: DONE ── */}
        {step === 'done' && (
          <div>
            <div className="border-b-2 border-glass-border px-6 py-5">
              <p className="text-[9px] font-bold font-mono uppercase tracking-[0.2em] text-text-secondary mb-1">Step 3 of 3</p>
              <h1 className="text-xl font-black uppercase tracking-tight">You're all set.</h1>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-2">
                {[
                  `Provider: ${selectedProvider}`,
                  selectedProvider === 'ollama' ? `Endpoint: ${ollamaEndpoint}` : 'Add API key in Settings → Model',
                  'Vault: ~/CharbotVault',
                  'Sessions sync to mobile via "Export to Phone"',
                ].map(line => (
                  <div key={line} className="flex items-center gap-2 text-[11px] font-mono text-text-primary">
                    <CheckCircle size={12} className="text-green-600 flex-shrink-0" />
                    {line}
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-mono text-text-secondary border-l-2 border-glass-border pl-3">
                Tip: open Settings anytime to change provider, model, persona, or enable the OS File Agent.
              </p>
            </div>
            <div className="px-6 pb-5">
              <button
                onClick={finish}
                className="w-full flex items-center justify-center gap-2 py-3 bg-text-primary text-bg-app text-[11px] font-bold font-mono uppercase tracking-wider border-2 border-text-primary shadow-[4px_4px_0px_var(--color-shadow-hard)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Start Chatting <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
