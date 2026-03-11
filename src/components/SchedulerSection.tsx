import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Play, ToggleLeft, ToggleRight, Clock, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassButton } from '@/components/ui/GlassButton';
import { useSession } from '@/context/SessionContext';
import { useSettings } from '@/context/SettingsContext';
import { useModelList } from '@/hooks/useModelList';
import { ModelSelector } from '@/components/ui/ModelSelector';

interface ScheduledTask {
  id: string;
  name: string;
  type: 'prompt_telegram' | 'export_session' | 'os_agent';
  cronExpr: string;
  config: string;
  enabled: number;
  lastRunAt: string | null;
  lastResult: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<ScheduledTask['type'], string> = {
  prompt_telegram: 'Prompt → Telegram',
  export_session: 'Export sesji',
  os_agent: 'OS Agent',
};

const DAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];

function pickerToCron(time: string, days: number[]): string {
  const [h, m] = time.split(':');
  const dayStr = days.length === 0 || days.length === 7 ? '*' : days.join(',');
  return `${m} ${h} * * ${dayStr}`;
}

function cronToHuman(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return expr;
  const [m, h, , , d] = parts;
  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  if (d === '*') return `Codziennie ${time}`;
  const dayNames = d.split(',').map(n => DAYS[parseInt(n, 10)] ?? n).join(', ');
  return `${dayNames} ${time}`;
}

const EMPTY_FORM = {
  name: '',
  type: 'prompt_telegram' as ScheduledTask['type'],
  time: '09:00',
  days: [1, 2, 3, 4, 5] as number[],
  prompt: '',
  model: 'llama3.2',
  sessionId: '',
  agentPrompt: '',
};

export function SchedulerSection() {
  const { sessions } = useSession();
  const { settings } = useSettings();
  const { models: ollamaModels, loading: modelsLoading, error: modelsError, refresh: refreshModels } = useModelList({
    provider: 'ollama',
    endpoint: settings.endpoint,
  });
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/scheduler/tasks');
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (task: ScheduledTask) => {
    await fetch(`/api/scheduler/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: task.enabled ? 0 : 1 }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/scheduler/tasks/${id}`, { method: 'DELETE' });
    load();
  };

  const handleRunNow = async (id: string) => {
    setRunningId(id);
    try {
      await fetch(`/api/scheduler/tasks/${id}/run`, { method: 'POST' });
      load();
    } finally { setRunningId(null); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const cronExpr = pickerToCron(form.time, form.days);
    let config: Record<string, any> = {};
    if (form.type === 'prompt_telegram') config = { prompt: form.prompt, model: form.model };
    else if (form.type === 'export_session') config = { sessionId: form.sessionId };
    else if (form.type === 'os_agent') config = { agentPrompt: form.agentPrompt, model: form.model };
    await fetch('/api/scheduler/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, type: form.type, cronExpr, config: JSON.stringify(config) }),
    });
    setForm(EMPTY_FORM);
    setShowForm(false);
    setSaving(false);
    load();
  };

  const toggleDay = (d: number) => {
    setForm(prev => ({
      ...prev,
      days: prev.days.includes(d) ? prev.days.filter(x => x !== d) : [...prev.days, d].sort(),
    }));
  };

  return (
    <div className="space-y-4">
      {/* Task list */}
      {loading ? (
        <div className="flex items-center gap-2 text-text-secondary font-mono text-xs py-4">
          <Loader2 size={14} className="animate-spin" /> Ładowanie…
        </div>
      ) : tasks.length === 0 ? (
        <div className="border-2 border-dashed border-glass-border p-6 text-center">
          <Clock size={22} className="mx-auto mb-2 text-text-secondary" />
          <p className="text-xs font-mono text-text-secondary uppercase tracking-widest">Brak zaplanowanych zadań</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <div key={task.id} className="border-2 border-glass-border bg-bg-app shadow-[2px_2px_0px_var(--color-shadow-hard)]">
              <div className="flex items-center gap-3 px-3 py-2.5">
                {/* Type badge */}
                <span className={cn(
                  'text-[9px] font-bold font-mono uppercase tracking-wider px-2 py-0.5 border flex-shrink-0',
                  task.type === 'prompt_telegram' ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/40' :
                  task.type === 'export_session' ? 'border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-950/40' :
                  'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/40',
                )}>
                  {TYPE_LABELS[task.type]}
                </span>

                {/* Name + cron */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-serif font-medium text-text-primary truncate">{task.name}</p>
                  <p className="text-[10px] font-mono text-text-secondary">{cronToHuman(task.cronExpr)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleRunNow(task.id)}
                    disabled={runningId === task.id}
                    title="Uruchom teraz"
                    className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {runningId === task.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Play size={13} />}
                  </button>
                  <button
                    onClick={() => handleToggle(task)}
                    title={task.enabled ? 'Wyłącz' : 'Włącz'}
                    className="p-1.5 transition-colors"
                  >
                    {task.enabled
                      ? <ToggleRight size={18} className="text-green-600" />
                      : <ToggleLeft size={18} className="text-text-secondary" />}
                  </button>
                  <button
                    onClick={() => setExpandedId(prev => prev === task.id ? null : task.id)}
                    className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {expandedId === task.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    title="Usuń"
                    className="p-1.5 text-text-secondary hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Expanded: last result */}
              {expandedId === task.id && (
                <div className="border-t-2 border-glass-border px-3 py-2 bg-black/5 dark:bg-white/5 space-y-1">
                  {task.lastRunAt && (
                    <p className="text-[10px] font-mono text-text-secondary">
                      Ostatnie uruchomienie: {new Date(task.lastRunAt).toLocaleString('pl-PL')}
                    </p>
                  )}
                  {task.lastResult && (
                    <pre className="text-[10px] font-mono text-text-primary whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                      {task.lastResult}
                    </pre>
                  )}
                  {!task.lastRunAt && <p className="text-[10px] font-mono text-text-secondary italic">Jeszcze nie uruchamiane.</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add task button / form */}
      {!showForm ? (
        <GlassButton size="sm" onClick={() => setShowForm(true)} className="w-full flex items-center justify-center gap-2">
          <Plus size={13} /> Dodaj zadanie
        </GlassButton>
      ) : (
        <div className="border-2 border-glass-border p-4 space-y-4 shadow-[4px_4px_0px_var(--color-shadow-hard)]">
          <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-text-secondary border-b-2 border-glass-border pb-2">
            Nowe zadanie
          </p>

          {/* Name */}
          <div>
            <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-1">Nazwa</label>
            <input
              className="glass-input w-full py-2 text-sm"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Moje zadanie…"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-2">Typ</label>
            <div className="grid grid-cols-3 gap-1">
              {(['prompt_telegram', 'export_session', 'os_agent'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(p => ({ ...p, type: t }))}
                  className={cn(
                    'py-2 text-[9px] font-bold font-mono uppercase tracking-wide border transition-all',
                    form.type === t
                      ? 'bg-text-primary text-bg-app border-text-primary'
                      : 'border-glass-border text-text-secondary hover:border-text-primary hover:text-text-primary',
                  )}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Time picker */}
          <div>
            <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-2">Godzina</label>
            <input
              type="time"
              className="glass-input py-2 text-sm font-mono"
              value={form.time}
              onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
            />
          </div>

          {/* Days */}
          <div>
            <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-2">Dni tygodnia</label>
            <div className="flex gap-1 flex-wrap">
              {DAYS.map((d, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i + 1)}
                  className={cn(
                    'w-9 h-9 text-[10px] font-bold font-mono border-2 transition-all',
                    form.days.includes(i + 1)
                      ? 'bg-text-primary text-bg-app border-text-primary'
                      : 'border-glass-border text-text-secondary hover:border-text-primary',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Config: prompt_telegram */}
          {form.type === 'prompt_telegram' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-1">Prompt</label>
                <textarea
                  className="glass-input w-full py-2 text-sm resize-none"
                  rows={3}
                  value={form.prompt}
                  onChange={e => setForm(p => ({ ...p, prompt: e.target.value }))}
                  placeholder="Co ma powiedzieć AI…"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-1">Model Ollama</label>
                <ModelSelector
                  value={form.model}
                  onChange={v => setForm(p => ({ ...p, model: v }))}
                  models={ollamaModels}
                  loading={modelsLoading}
                  error={modelsError}
                  onRefresh={refreshModels}
                  placeholder="llama3.2"
                />
              </div>
            </div>
          )}

          {/* Config: export_session */}
          {form.type === 'export_session' && (
            <div>
              <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-1">Sesja</label>
              <select
                className="glass-input w-full py-2 text-sm"
                value={form.sessionId}
                onChange={e => setForm(p => ({ ...p, sessionId: e.target.value }))}
              >
                <option value="">— wybierz sesję —</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>{s.title || s.id}</option>
                ))}
              </select>
            </div>
          )}

          {/* Config: os_agent */}
          {form.type === 'os_agent' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-1">Polecenie dla agenta</label>
                <textarea
                  className="glass-input w-full py-2 text-sm resize-none"
                  rows={3}
                  value={form.agentPrompt}
                  onChange={e => setForm(p => ({ ...p, agentPrompt: e.target.value }))}
                  placeholder="Sprawdź rozmiar katalogu ~/Downloads…"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-1">Model Ollama</label>
                <ModelSelector
                  value={form.model}
                  onChange={v => setForm(p => ({ ...p, model: v }))}
                  models={ollamaModels}
                  loading={modelsLoading}
                  error={modelsError}
                  onRefresh={refreshModels}
                  placeholder="llama3.2"
                />
              </div>
            </div>
          )}

          {/* Preview cron */}
          <p className="text-[10px] font-mono text-text-secondary">
            Wyrażenie cron: <span className="font-bold text-text-primary">{pickerToCron(form.time, form.days)}</span>
            {' '}→ {cronToHuman(pickerToCron(form.time, form.days))}
          </p>

          <div className="flex gap-2 pt-1">
            <GlassButton size="sm" onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1">
              {saving ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
              Zapisz
            </GlassButton>
            <GlassButton size="sm" variant="ghost" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>
              Anuluj
            </GlassButton>
          </div>
        </div>
      )}
    </div>
  );
}
