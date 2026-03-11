/**
 * Bundles server.ts + server/*.ts into a single dist-server/server.cjs
 * using esbuild (already present via tsx).
 *
 * Native modules that cannot be bundled are marked external and must be
 * present in node_modules alongside the output file.
 */

import { build } from 'esbuild';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const OUT_DIR = path.join(ROOT, 'dist-server');

// Only native addons that contain .node binaries stay external.
// Everything else is bundled so the packaged app needs no external node_modules.
const EXTERNALS = [
  'better-sqlite3',  // native .node addon — cannot be bundled
  'ws',              // optional native deps (bufferutil, utf-8-validate) conflict with esbuild bundling
  'bufferutil',      // ws optional peer
  'utf-8-validate',  // ws optional peer
  'node-cron',       // uses __dirname in ESM bundle — crashes when inlined by esbuild
];

console.log('Building server bundle…');

fs.mkdirSync(OUT_DIR, { recursive: true });

await build({
  entryPoints: [path.join(ROOT, 'server.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: path.join(OUT_DIR, 'server.mjs'),
  external: EXTERNALS,
  sourcemap: false,
  minify: false,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  // Fix "Dynamic require is not supported" — inject require() shim for bundled CJS deps (express, depd, etc.)
  banner: {
    js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
  },
});

console.log(`Server bundled → ${OUT_DIR}/server.mjs`);
console.log('Done.');
