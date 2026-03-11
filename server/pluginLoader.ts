import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { appendLog } from './vault.js';

export interface Plugin {
  name: string;
  description: string;
  parameters: Record<string, string>;
  execute(args: Record<string, any>, ctx: PluginCtx): Promise<string>;
  source: 'file' | 'webhook';
}

export interface PluginCtx {
  vaultDir: string;
  allowedDirs: string[];
}

export interface WebhookToolDef {
  name: string;
  description: string;
  parameters: Record<string, string>;
  url: string;
  method: 'GET' | 'POST';
}

const loadedPlugins = new Map<string, Plugin>();

function webhookToPlugin(def: WebhookToolDef): Plugin {
  return {
    name: def.name,
    description: def.description,
    parameters: def.parameters,
    source: 'webhook',
    async execute(args) {
      let url = def.url;
      // Replace {param} placeholders in URL
      for (const [key, val] of Object.entries(args)) {
        url = url.replaceAll(`{${key}}`, encodeURIComponent(String(val)));
      }
      const init: RequestInit = {
        method: def.method,
        signal: AbortSignal.timeout(15_000),
      };
      if (def.method === 'POST' && Object.keys(args).length > 0) {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify(args);
      }
      const res = await fetch(url, init);
      const text = await res.text();
      return text.slice(0, 4000);
    },
  };
}

function getPluginsDirPath(vaultDir: string): string {
  return path.join(vaultDir, 'plugins');
}

function getWebhookConfigPath(vaultDir: string): string {
  return path.join(vaultDir, 'plugins-webhook.json');
}

export async function loadPlugins(vaultDir: string): Promise<void> {
  loadedPlugins.clear();
  const pluginsDir = getPluginsDirPath(vaultDir);

  // --- File plugins (.mjs) ---
  try {
    const entries = await fs.readdir(pluginsDir);
    for (const entry of entries) {
      if (!entry.endsWith('.mjs')) continue;
      const filePath = path.join(pluginsDir, entry);
      try {
        const mod = await import(pathToFileURL(filePath).href);
        if (typeof mod.name !== 'string' || typeof mod.execute !== 'function') {
          appendLog('plugins', `Skipped ${entry}: missing name or execute export`).catch(() => {});
          continue;
        }
        const plugin: Plugin = {
          name: mod.name,
          description: mod.description ?? '',
          parameters: mod.parameters ?? {},
          execute: mod.execute,
          source: 'file',
        };
        loadedPlugins.set(plugin.name, plugin);
        appendLog('plugins', `Loaded file plugin: ${plugin.name}`).catch(() => {});
      } catch (e: any) {
        appendLog('plugins', `Failed to load ${entry}: ${e.message}`).catch(() => {});
      }
    }
  } catch { /* plugins dir missing — skip */ }

  // --- Webhook plugins ---
  const webhookPath = getWebhookConfigPath(vaultDir);
  if (existsSync(webhookPath)) {
    try {
      const raw = await fs.readFile(webhookPath, 'utf-8');
      const defs = JSON.parse(raw) as WebhookToolDef[];
      for (const def of defs) {
        if (!def.name || !def.url) continue;
        const plugin = webhookToPlugin(def);
        loadedPlugins.set(plugin.name, plugin);
      }
      appendLog('plugins', `Loaded ${defs.length} webhook plugin(s)`).catch(() => {});
    } catch (e: any) {
      appendLog('plugins', `Failed to load webhooks: ${e.message}`).catch(() => {});
    }
  }
}

export function getLoadedPlugins(): Plugin[] {
  return Array.from(loadedPlugins.values());
}

export async function reloadPlugins(vaultDir: string): Promise<void> {
  await loadPlugins(vaultDir);
}

export async function execPlugin(name: string, args: Record<string, any>, ctx: PluginCtx): Promise<string> {
  const plugin = loadedPlugins.get(name);
  if (!plugin) throw new Error(`Plugin not found: ${name}`);
  return plugin.execute(args, ctx);
}

// --- Webhook CRUD ---

export async function saveWebhookTool(vaultDir: string, def: WebhookToolDef): Promise<void> {
  const webhookPath = getWebhookConfigPath(vaultDir);
  let defs: WebhookToolDef[] = [];
  try {
    const raw = await fs.readFile(webhookPath, 'utf-8');
    defs = JSON.parse(raw) as WebhookToolDef[];
  } catch { /* first time */ }
  // Upsert by name
  const idx = defs.findIndex(d => d.name === def.name);
  if (idx >= 0) defs[idx] = def;
  else defs.push(def);
  await fs.writeFile(webhookPath, JSON.stringify(defs, null, 2), 'utf-8');
  // Reload into memory
  const plugin = webhookToPlugin(def);
  loadedPlugins.set(plugin.name, plugin);
}

export async function deleteWebhookTool(vaultDir: string, name: string): Promise<void> {
  const webhookPath = getWebhookConfigPath(vaultDir);
  let defs: WebhookToolDef[] = [];
  try {
    const raw = await fs.readFile(webhookPath, 'utf-8');
    defs = JSON.parse(raw) as WebhookToolDef[];
  } catch { return; }
  defs = defs.filter(d => d.name !== name);
  await fs.writeFile(webhookPath, JSON.stringify(defs, null, 2), 'utf-8');
  loadedPlugins.delete(name);
}
