import cron from 'node-cron';
import type { Database } from 'better-sqlite3';
import { appendLog } from './vault.js';

export interface ScheduledTask {
  id: string;
  name: string;
  type: 'prompt_telegram' | 'export_session' | 'os_agent';
  cronExpr: string;
  config: string; // JSON string
  enabled: number;
  lastRunAt: string | null;
  lastResult: string | null;
  createdAt: string;
}

export interface SchedulerConfig {
  /** Called to send a Telegram message — wraps sendTelegramNotification */
  sendTelegram: (text: string) => Promise<void>;
  /** Called to export/generate mobile portal for a session */
  generatePortal?: (sessionId: string) => Promise<string>;
  ollamaEndpoint: string;
  ollamaModel: string;
}

// Active cron jobs keyed by task id
const activeJobs = new Map<string, ReturnType<typeof cron.schedule>>();

/** Load all enabled tasks from DB and register their cron jobs. */
export function initScheduler(db: Database, getConfig: () => SchedulerConfig): void {
  const tasks = db.prepare(`SELECT * FROM scheduled_tasks WHERE enabled = 1`).all() as ScheduledTask[];
  for (const task of tasks) {
    _registerJob(task, db, getConfig);
  }
  appendLog('scheduler', `Initialised — ${tasks.length} task(s) active`).catch(() => {});
}

function _registerJob(task: ScheduledTask, db: Database, getConfig: () => SchedulerConfig): void {
  if (!cron.validate(task.cronExpr)) {
    appendLog('scheduler', `Invalid cron expression for task "${task.name}": ${task.cronExpr}`).catch(() => {});
    return;
  }
  const job = cron.schedule(task.cronExpr, async () => {
    let result = '';
    try {
      result = await _executeTask(task, getConfig());
    } catch (e: any) {
      result = `Error: ${e.message}`;
    }
    const now = new Date().toISOString();
    db.prepare(`UPDATE scheduled_tasks SET lastRunAt = ?, lastResult = ? WHERE id = ?`)
      .run(now, result.slice(0, 2000), task.id);
    appendLog('scheduler', `[${task.name}] ${result.slice(0, 200)}`).catch(() => {});
  });
  activeJobs.set(task.id, job);
}

async function _executeTask(task: ScheduledTask, config: SchedulerConfig): Promise<string> {
  const cfg = JSON.parse(task.config) as Record<string, any>;

  if (task.type === 'prompt_telegram') {
    const prompt: string = cfg.prompt ?? 'Hello!';
    const model: string = cfg.model ?? config.ollamaModel;
    const res = await fetch(`${config.ollamaEndpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Ollama error: ${await res.text()}`);
    const data = await res.json() as any;
    const reply: string = (data.message?.content ?? '').slice(0, 4000);
    await config.sendTelegram(reply || '(no response)');
    return reply.slice(0, 300) || '(no response)';
  }

  if (task.type === 'export_session') {
    const sessionId: string = cfg.sessionId ?? '';
    if (!sessionId) throw new Error('No sessionId configured');
    let info = `Session ${sessionId} export triggered`;
    if (config.generatePortal) {
      const portalPath = await config.generatePortal(sessionId);
      info = `Exported to: ${portalPath}`;
    }
    await config.sendTelegram(info);
    return info;
  }

  if (task.type === 'os_agent') {
    const agentPrompt: string = cfg.agentPrompt ?? 'Report system status.';
    const model: string = cfg.model ?? config.ollamaModel;
    const res = await fetch(`${config.ollamaEndpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: agentPrompt }], stream: false }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Ollama error: ${await res.text()}`);
    const data = await res.json() as any;
    const reply: string = (data.message?.content ?? '').slice(0, 4000);
    await config.sendTelegram(reply || '(no response)');
    return reply.slice(0, 300) || '(no response)';
  }

  throw new Error(`Unknown task type: ${(task as any).type}`);
}

/** Stop and re-register a single task (call after update/toggle). */
export function refreshTask(id: string, db: Database, getConfig: () => SchedulerConfig): void {
  removeTask(id);
  const task = db.prepare(`SELECT * FROM scheduled_tasks WHERE id = ?`).get(id) as ScheduledTask | undefined;
  if (task && task.enabled) _registerJob(task, db, getConfig);
}

/** Stop a task's cron job. */
export function removeTask(id: string): void {
  const job = activeJobs.get(id);
  if (job) { job.stop(); activeJobs.delete(id); }
}

/** Execute a task immediately, update DB, return result string. */
export async function runTaskNow(id: string, db: Database, getConfig: () => SchedulerConfig): Promise<string> {
  const task = db.prepare(`SELECT * FROM scheduled_tasks WHERE id = ?`).get(id) as ScheduledTask | undefined;
  if (!task) throw new Error('Task not found');
  const result = await _executeTask(task, getConfig());
  const now = new Date().toISOString();
  db.prepare(`UPDATE scheduled_tasks SET lastRunAt = ?, lastResult = ? WHERE id = ?`)
    .run(now, result.slice(0, 2000), task.id);
  return result;
}
