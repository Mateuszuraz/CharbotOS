/**
 * Sprint 4A — Electron build pipeline
 *
 * Steps:
 *   1. npm run build         → Vite frontend → dist/
 *   2. build-server.mjs      → esbuild server → dist-server/server.mjs
 *   3. esbuild main.ts       → CJS → dist-electron/main.js
 *   4. electron-builder      → NSIS installer → release/
 */

import { build } from 'esbuild';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

function run(cmd, label) {
  console.log(`\n▶ ${label}…`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

// ── Step 1: Vite frontend ─────────────────────────────────────────────────────
run('npm run build', 'Step 1: Vite frontend build');

// ── Step 2: esbuild server bundle ────────────────────────────────────────────
run('node scripts/build-server.mjs', 'Step 2: Server bundle');

// ── Step 3: esbuild Electron main (.cjs — avoids ESM/CJS conflict with "type":"module") ──
console.log('\n▶ Step 3: Electron main bundle…');
const OUT_ELECTRON = path.join(ROOT, 'dist-electron');
fs.mkdirSync(OUT_ELECTRON, { recursive: true });

// Bundle main.ts → ESM .mjs (import.meta.url works; Electron 28+ supports ESM main)
await build({
  entryPoints: [path.join(ROOT, 'electron', 'main.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: path.join(OUT_ELECTRON, 'main.mjs'),
  external: ['electron'],
  sourcemap: false,
  minify: false,
});

// Bundle preload.ts → CJS .cjs (preload must be CJS for contextIsolation)
await build({
  entryPoints: [path.join(ROOT, 'electron', 'preload.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: path.join(OUT_ELECTRON, 'preload.cjs'),
  external: ['electron'],
});

console.log(`Electron bundle → dist-electron/`);

// ── Step 3.5: Rebuild better-sqlite3 from source for Electron's Node.js ABI ──
// electron-builder's npmRebuild uses buildFromSource=false (tries prebuilt first).
// If no prebuilt exists for this Electron version it silently keeps the Node.js binary,
// causing an ABI mismatch. We force a source build here before packaging.
const electronVersion = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'node_modules', 'electron', 'package.json'), 'utf-8')
).version;
console.log(`\n▶ Step 3.5: Rebuilding better-sqlite3 from source for Electron ${electronVersion}…`);
run(
  `node node_modules/@electron/rebuild/lib/cli.js --force --build-from-source --version ${electronVersion} --which-module better-sqlite3`,
  `Step 3.5: better-sqlite3 native rebuild (Electron ${electronVersion})`
);

// ── Step 4: electron-builder ──────────────────────────────────────────────────
run('npx electron-builder --win', 'Step 4: electron-builder (Windows installer)');

// ── Step 5: Restore better-sqlite3 for Node.js development ──────────────────
// After packaging, rebuild for the local Node.js so `npx tsx server.ts` keeps working.
console.log('\n▶ Step 5: Restoring better-sqlite3 for local Node.js dev…');
run('npm rebuild better-sqlite3', 'Step 5: better-sqlite3 restore for Node.js');

console.log('\n✓ Build complete — check the release/ directory.');
