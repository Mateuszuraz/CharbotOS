import fs from 'fs/promises';
import path from 'path';
import { getVaultDir } from './vault.js';

export interface AiKeys {
  openai: string;
  google: string;
  anthropic: string;
}

function getKeysPath(): string {
  return path.join(getVaultDir(), 'ai-keys.json');
}

export async function loadAiKeys(): Promise<AiKeys> {
  try {
    const raw = await fs.readFile(getKeysPath(), 'utf-8');
    return { openai: '', google: '', anthropic: '', ...JSON.parse(raw) };
  } catch {
    // Fall back to environment variables
    return {
      openai: process.env.OPENAI_API_KEY ?? '',
      google: process.env.GEMINI_API_KEY ?? '',
      anthropic: process.env.ANTHROPIC_API_KEY ?? '',
    };
  }
}

export async function saveAiKeys(partial: Partial<AiKeys>): Promise<void> {
  const existing = await loadAiKeys();
  const updated: AiKeys = { ...existing, ...partial };
  // Never store empty strings over existing values
  if (!partial.openai) updated.openai = existing.openai;
  if (!partial.google) updated.google = existing.google;
  if (!partial.anthropic) updated.anthropic = existing.anthropic;
  await fs.writeFile(getKeysPath(), JSON.stringify(updated, null, 2), 'utf-8');
}

function mask(key: string): string {
  if (!key) return '';
  if (key.length < 10) return '••••••';
  return `${key.slice(0, 6)}${'•'.repeat(Math.min(key.length - 10, 20))}${key.slice(-4)}`;
}

export async function getMaskedKeys(): Promise<{ openai: string; google: string; anthropic: string; hasSaved: boolean }> {
  const keys = await loadAiKeys();
  return {
    openai: mask(keys.openai),
    google: mask(keys.google),
    anthropic: mask(keys.anthropic),
    hasSaved: !!(keys.openai || keys.google || keys.anthropic),
  };
}
