import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import XLSX from 'xlsx';

export const DEFAULT_ALLOWED_DIRS = [
  path.join(os.homedir(), 'Downloads'),
  path.join(os.homedir(), 'Desktop'),
  path.join(os.homedir(), 'Documents'),
  path.join(os.homedir(), 'CharbotVault'),
];

/** Expand ~ to home dir and resolve to absolute path */
function expandPath(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(1));
  }
  return path.resolve(p);
}

/** Validate that filePath is within one of allowedDirs (symlink-safe) */
async function validatePath(filePath: string, allowedDirs: string[]): Promise<string> {
  const resolved = expandPath(filePath);
  // P2: resolve symlinks before prefix check to prevent symlink escape attacks
  let real: string;
  try {
    real = await fs.realpath(resolved);
  } catch {
    // File doesn't exist yet (e.g. write target) — use resolved path directly
    real = resolved;
  }
  const expanded = allowedDirs.map(d => expandPath(d));
  const isAllowed = expanded.some(allowed => {
    const rel = path.relative(allowed, real);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
  });
  if (!isAllowed) {
    throw new Error(`Access denied: "${real}" is outside allowed directories.`);
  }
  return real;
}

export interface DirEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

export async function listDir(dir: string, allowedDirs: string[]): Promise<DirEntry[]> {
  const resolved = await validatePath(dir, allowedDirs);
  const entries = await fs.readdir(resolved, { withFileTypes: true });
  return entries.map(e => ({
    name: e.name,
    isDirectory: e.isDirectory(),
    path: path.join(resolved, e.name),
  }));
}

export async function searchFiles(query: string, dir: string, allowedDirs: string[]): Promise<string[]> {
  const resolved = await validatePath(dir, allowedDirs);
  const results: string[] = [];
  const lowerQuery = query.toLowerCase();

  async function walk(currentDir: string, depth: number): Promise<void> {
    if (depth > 4 || results.length >= 50) return;
    let entries: any[];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= 50) return;
      // Skip hidden files/dirs
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.name.toLowerCase().includes(lowerQuery)) {
        results.push(fullPath);
      }
      if (entry.isDirectory()) {
        await walk(fullPath, depth + 1);
      }
    }
  }

  await walk(resolved, 0);
  return results;
}

const TEXT_EXTS = new Set(['.txt', '.md', '.json', '.csv', '.html', '.css', '.js', '.ts', '.tsx', '.jsx',
  '.xml', '.py', '.sh', '.yaml', '.yml', '.toml', '.ini', '.env', '.sql', '.rs', '.go', '.java',
  '.c', '.cpp', '.h', '.rb', '.php', '.log']);
const XLSX_EXTS = new Set(['.xlsx', '.xls', '.ods']);

export async function readFile(
  filePath: string,
  allowedDirs: string[],
): Promise<{ type: 'text'; content: string } | { type: 'xlsx'; sheets: Record<string, string> }> {
  const resolved = await validatePath(filePath, allowedDirs);
  const ext = path.extname(resolved).toLowerCase();

  if (XLSX_EXTS.has(ext)) {
    const buf = await fs.readFile(resolved);
    const workbook = XLSX.read(buf, { type: 'buffer' });
    const sheets: Record<string, string> = {};
    for (const name of workbook.SheetNames) {
      sheets[name] = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
    }
    return { type: 'xlsx', sheets };
  }

  // Size guard: 500KB for text files
  const stat = await fs.stat(resolved);
  if (stat.size > 500 * 1024) {
    throw new Error(`File too large (${Math.round(stat.size / 1024)}KB). Max 500KB for text files.`);
  }

  const content = await fs.readFile(resolved, 'utf-8');
  return { type: 'text', content };
}

export async function writeFile(
  filePath: string,
  content: string,
  allowedDirs: string[],
): Promise<{ path: string }> {
  const resolved = await validatePath(filePath, allowedDirs);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, content, 'utf-8');
  return { path: resolved };
}

export async function appendCsv(
  filePath: string,
  rowData: Record<string, string | number>,
  allowedDirs: string[],
): Promise<{ path: string }> {
  const resolved = await validatePath(filePath, allowedDirs);

  let fileExists = false;
  try {
    await fs.access(resolved);
    fileExists = true;
  } catch {
    fileExists = false;
  }

  const headers = Object.keys(rowData);
  const values = headers.map(h => {
    const v = String(rowData[h] ?? '');
    // Escape CSV: wrap in quotes if contains comma, newline, or quote
    return v.includes(',') || v.includes('\n') || v.includes('"')
      ? `"${v.replace(/"/g, '""')}"`
      : v;
  });

  const row = values.join(',') + '\n';

  if (!fileExists) {
    const headerRow = headers.join(',') + '\n';
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, headerRow + row, 'utf-8');
  } else {
    await fs.appendFile(resolved, row, 'utf-8');
  }

  return { path: resolved };
}
