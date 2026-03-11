import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/** Returns the Vault root directory (from env or ~/CharbotVault). */
export function getVaultDir(): string {
  return process.env.CHARBOT_VAULT_DIR || path.join(os.homedir(), 'CharbotVault');
}

/** Returns the mobile portal output directory. */
export function getMobileDir(): string {
  return process.env.CHARBOT_MOBILE_DIR || path.join(getVaultDir(), 'mobile');
}

/** Ensures all required vault sub-directories exist. */
export async function ensureVaultDirs(): Promise<void> {
  const vault = getVaultDir();
  await fs.mkdir(path.join(vault, 'uploads'), { recursive: true });
  await fs.mkdir(path.join(vault, 'logs'), { recursive: true });
  await fs.mkdir(path.join(vault, 'plugins'), { recursive: true });
  await fs.mkdir(getMobileDir(), { recursive: true });
}

const LOG_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Appends a timestamped line to <Vault>/logs/<logName>.log, rotating at 5 MB */
export async function appendLog(logName: string, message: string): Promise<void> {
  const logPath = path.join(getVaultDir(), 'logs', `${logName}.log`);
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    const stat = await fs.stat(logPath);
    if (stat.size >= LOG_MAX_BYTES) {
      await fs.rename(logPath, logPath.replace('.log', `.${Date.now()}.log`));
    }
  } catch { /* file doesn't exist yet — no rotation needed */ }
  await fs.appendFile(logPath, line, 'utf-8').catch(() => {});
}
