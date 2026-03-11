import fs from 'fs/promises';
import path from 'path';
import { getVaultDir } from './vault.js';

export const SUPPORTED_FORMATS = new Set(['txt', 'md', 'html', 'json', 'csv', 'pdf']);

export function getDocsDir(): string {
  return path.join(getVaultDir(), 'documents');
}

async function ensureDocsDir(): Promise<void> {
  await fs.mkdir(getDocsDir(), { recursive: true });
}

function sanitize(name: string): string {
  // Strip path traversal, keep only safe characters
  return path.basename(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------
export async function saveDocument(
  filename: string,
  content: string,
): Promise<{ filename: string; savedPath: string; bytes: number }> {
  await ensureDocsDir();
  const safe = sanitize(filename);
  if (!safe) throw new Error('Invalid filename');

  const ext = path.extname(safe).slice(1).toLowerCase();
  const filePath = path.join(getDocsDir(), safe);

  let bytes: number;
  if (ext === 'pdf') {
    bytes = await writePdf(content, filePath);
  } else {
    const data = ext === 'html' ? wrapHtml(safe, content) : content;
    const buf = Buffer.from(data, 'utf-8');
    await fs.writeFile(filePath, buf);
    bytes = buf.length;
  }

  return { filename: safe, savedPath: filePath, bytes };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
export interface DocEntry {
  name: string;
  ext: string;
  size: number;
  modifiedAt: string;
}

export async function listDocuments(): Promise<DocEntry[]> {
  await ensureDocsDir();
  const entries = await fs.readdir(getDocsDir(), { withFileTypes: true }).catch(() => []);
  const result: DocEntry[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    const stat = await fs.stat(path.join(getDocsDir(), e.name)).catch(() => null);
    if (!stat) continue;
    result.push({
      name: e.name,
      ext: path.extname(e.name).slice(1).toLowerCase(),
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  }
  return result.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
export async function deleteDocument(filename: string): Promise<void> {
  await fs.unlink(path.join(getDocsDir(), sanitize(filename)));
}

// ---------------------------------------------------------------------------
// Get file path (for download)
// ---------------------------------------------------------------------------
export function getDocPath(filename: string): string {
  return path.join(getDocsDir(), sanitize(filename));
}

// ---------------------------------------------------------------------------
// HTML wrapper (for bare HTML snippets)
// ---------------------------------------------------------------------------
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wrapHtml(title: string, body: string): string {
  const isFullDoc = /^\s*<!doctype/i.test(body) || /^\s*<html/i.test(body);
  if (isFullDoc) return body;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 820px; margin: 2.5rem auto; padding: 0 1.5rem; line-height: 1.7; color: #1a1a1a; }
    h1, h2, h3 { font-weight: 700; margin-top: 2em; }
    pre { background: #f4f4f4; padding: 1rem; overflow-x: auto; border-left: 4px solid #ccc; }
    code { background: #f4f4f4; padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.9em; }
    table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #ddd; padding: 8px; }
    th { background: #f4f4f4; font-weight: 700; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// PDF generation via pdfkit
// ---------------------------------------------------------------------------
async function writePdf(content: string, filePath: string): Promise<number> {
  // Dynamic import to handle pdfkit as CJS in ESM project
  const { default: PDFDocument } = await import('pdfkit') as any;

  const doc = new PDFDocument({ margin: 60, size: 'A4' });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const lines = content.split('\n');

  for (const rawLine of lines) {
    if (rawLine.startsWith('# ')) {
      doc.fontSize(22).font('Helvetica-Bold').text(rawLine.slice(2).trim(), { lineGap: 6 });
      doc.moveDown(0.5);
    } else if (rawLine.startsWith('## ')) {
      doc.fontSize(16).font('Helvetica-Bold').text(rawLine.slice(3).trim(), { lineGap: 4 });
      doc.moveDown(0.3);
    } else if (rawLine.startsWith('### ')) {
      doc.fontSize(13).font('Helvetica-Bold').text(rawLine.slice(4).trim(), { lineGap: 4 });
      doc.moveDown(0.2);
    } else if (/^[*\-] /.test(rawLine)) {
      doc.fontSize(11).font('Helvetica').text('• ' + rawLine.slice(2).trim(), { indent: 20, lineGap: 3 });
    } else if (/^\d+\. /.test(rawLine)) {
      const m = rawLine.match(/^(\d+)\. (.*)$/);
      if (m) doc.fontSize(11).font('Helvetica').text(`${m[1]}. ${m[2].trim()}`, { indent: 20, lineGap: 3 });
    } else if (rawLine.trim() === '') {
      doc.moveDown(0.5);
    } else {
      // Strip inline markdown markers for clean plain text
      const plain = rawLine
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/~~(.+?)~~/g, '$1')
        .replace(/\[(.+?)\]\(.+?\)/g, '$1');
      doc.fontSize(11).font('Helvetica').text(plain.trim(), { lineGap: 3 });
    }
  }

  // Footer with generation date
  const pageHeight = doc.page.height;
  doc.fontSize(8).font('Helvetica').fillColor('#999')
    .text(`Generated by Charbot OS · ${new Date().toLocaleString()}`, 60, pageHeight - 50, {
      width: doc.page.width - 120, align: 'center',
    });

  doc.end();

  await new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
  });

  const buf = Buffer.concat(chunks);
  await fs.writeFile(filePath, buf);
  return buf.length;
}
