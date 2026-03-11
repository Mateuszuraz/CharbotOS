import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, RefreshCw, Loader2, Webhook, FileCode2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassButton } from '@/components/ui/GlassButton';

interface Plugin {
  name: string;
  description: string;
  parameters: Record<string, string>;
  source: 'file' | 'webhook';
}

interface ParamRow { key: string; desc: string }

const EMPTY_WEBHOOK = {
  name: '',
  description: '',
  url: '',
  method: 'GET' as 'GET' | 'POST',
  params: [] as ParamRow[],
};

export function PluginsSection() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_WEBHOOK);
  const [saving, setSaving] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/plugins');
      const data = await res.json();
      setPlugins(data.plugins ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleReload = async () => {
    setReloading(true);
    try {
      await fetch('/api/plugins/reload', { method: 'POST' });
      await load();
    } finally { setReloading(false); }
  };

  const handleDelete = async (name: string) => {
    setDeletingName(name);
    await fetch(`/api/plugins/webhook/${encodeURIComponent(name)}`, { method: 'DELETE' });
    await load();
    setDeletingName(null);
  };

  const addParam = () => setForm(p => ({ ...p, params: [...p.params, { key: '', desc: '' }] }));
  const removeParam = (i: number) => setForm(p => ({ ...p, params: p.params.filter((_, idx) => idx !== i) }));
  const updateParam = (i: number, field: 'key' | 'desc', val: string) =>
    setForm(p => ({ ...p, params: p.params.map((row, idx) => idx === i ? { ...row, [field]: val } : row) }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) return;
    setSaving(true);
    const parameters = Object.fromEntries(form.params.filter(r => r.key.trim()).map(r => [r.key.trim(), r.desc]));
    await fetch('/api/plugins/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, description: form.description, url: form.url, method: form.method, parameters }),
    });
    setForm(EMPTY_WEBHOOK);
    setShowForm(false);
    setSaving(false);
    load();
  };

  const filePlugins = plugins.filter(p => p.source === 'file');
  const webhookPlugins = plugins.filter(p => p.source === 'webhook');

  return (
    <div className="space-y-6">

      {/* File plugins */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-bold font-mono uppercase tracking-[0.15em] text-text-secondary">
            File Plugins (.mjs)
          </h3>
          <button
            onClick={handleReload}
            disabled={reloading}
            className="flex items-center gap-1.5 text-[10px] font-bold font-mono uppercase tracking-wide text-text-secondary hover:text-text-primary transition-colors"
          >
            <RefreshCw size={11} className={cn(reloading && 'animate-spin')} />
            Reload
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-text-secondary font-mono text-xs py-3">
            <Loader2 size={12} className="animate-spin" /> Ładowanie…
          </div>
        ) : filePlugins.length === 0 ? (
          <div className="border-2 border-dashed border-glass-border p-4 text-center">
            <FileCode2 size={20} className="mx-auto mb-1.5 text-text-secondary" />
            <p className="text-[10px] font-mono text-text-secondary uppercase tracking-widest">
              Brak wtyczek — umieść pliki .mjs w CharbotVault/plugins/
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filePlugins.map(p => (
              <div key={p.name} className="border-2 border-glass-border p-3 shadow-[2px_2px_0px_var(--color-shadow-hard)]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-bold font-mono uppercase tracking-wider px-2 py-0.5 border border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/40">
                    FILE
                  </span>
                  <span className="text-sm font-bold font-mono text-text-primary">{p.name}</span>
                </div>
                {p.description && <p className="text-xs text-text-secondary font-serif">{p.description}</p>}
                {Object.keys(p.parameters).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {Object.keys(p.parameters).map(k => (
                      <span key={k} className="text-[9px] font-mono bg-black/5 dark:bg-white/5 px-1.5 py-0.5 border border-glass-border">
                        {k}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Webhook plugins */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-bold font-mono uppercase tracking-[0.15em] text-text-secondary">
            Webhook Tools
          </h3>
        </div>

        {webhookPlugins.length > 0 && (
          <div className="space-y-2 mb-3">
            {webhookPlugins.map(p => (
              <div key={p.name} className="border-2 border-glass-border p-3 flex items-start gap-3 shadow-[2px_2px_0px_var(--color-shadow-hard)]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-bold font-mono uppercase tracking-wider px-2 py-0.5 border border-green-500 text-green-600 bg-green-50 dark:bg-green-950/40">
                      WEBHOOK
                    </span>
                    <span className="text-sm font-bold font-mono text-text-primary">{p.name}</span>
                  </div>
                  {p.description && <p className="text-xs text-text-secondary font-serif">{p.description}</p>}
                  {Object.keys(p.parameters).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {Object.keys(p.parameters).map(k => (
                        <span key={k} className="text-[9px] font-mono bg-black/5 dark:bg-white/5 px-1.5 py-0.5 border border-glass-border">
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(p.name)}
                  disabled={deletingName === p.name}
                  className="p-1.5 text-text-secondary hover:text-red-500 transition-colors flex-shrink-0"
                >
                  {deletingName === p.name ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Create webhook form */}
        {!showForm ? (
          <GlassButton size="sm" onClick={() => setShowForm(true)} className="w-full flex items-center justify-center gap-2">
            <Plus size={13} /> <Webhook size={13} /> Utwórz webhook tool
          </GlassButton>
        ) : (
          <div className="border-2 border-glass-border p-4 space-y-4 shadow-[4px_4px_0px_var(--color-shadow-hard)]">
            <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-text-secondary border-b-2 border-glass-border pb-2">
              Nowy Webhook Tool
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-1">Nazwa</label>
                <input
                  className="glass-input w-full py-2 text-sm font-mono"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value.replace(/\s/g, '_') }))}
                  placeholder="weather"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-1">Metoda</label>
                <div className="flex gap-1">
                  {(['GET', 'POST'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setForm(p => ({ ...p, method: m }))}
                      className={cn(
                        'flex-1 py-1.5 text-[10px] font-bold font-mono border-2 transition-all',
                        form.method === m
                          ? 'bg-text-primary text-bg-app border-text-primary'
                          : 'border-glass-border text-text-secondary hover:border-text-primary',
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-1">Opis</label>
              <input
                className="glass-input w-full py-2 text-sm"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Gets current weather for a city."
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary mb-1">URL template</label>
              <input
                className="glass-input w-full py-2 text-sm font-mono"
                value={form.url}
                onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                placeholder="https://wttr.in/{city}?format=3"
              />
              <p className="text-[9px] font-mono text-text-secondary mt-1">Użyj {'{param}'} dla parametrów w URL</p>
            </div>

            {/* Parameters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary">Parametry</label>
                <button onClick={addParam} className="text-[10px] font-bold font-mono uppercase text-text-secondary hover:text-text-primary flex items-center gap-1">
                  <Plus size={10} /> dodaj
                </button>
              </div>
              {form.params.map((row, i) => (
                <div key={i} className="flex gap-2 mb-1.5">
                  <input
                    className="glass-input py-1.5 text-xs font-mono w-28"
                    value={row.key}
                    onChange={e => updateParam(i, 'key', e.target.value)}
                    placeholder="city"
                  />
                  <input
                    className="glass-input py-1.5 text-xs flex-1"
                    value={row.desc}
                    onChange={e => updateParam(i, 'desc', e.target.value)}
                    placeholder="opis parametru"
                  />
                  <button onClick={() => removeParam(i)} className="text-text-secondary hover:text-red-500 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <GlassButton size="sm" onClick={handleSave} disabled={saving || !form.name.trim() || !form.url.trim()} className="flex-1">
                {saving ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                Zapisz webhook
              </GlassButton>
              <GlassButton size="sm" variant="ghost" onClick={() => { setShowForm(false); setForm(EMPTY_WEBHOOK); }}>
                Anuluj
              </GlassButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
