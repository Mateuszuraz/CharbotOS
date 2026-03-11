import fs from 'fs/promises';
import path from 'path';
import { getMobileDir } from './vault.js';
import type { SessionRow } from './db.js';

const CSS = `
:root { --ink: #1a1a1a; --paper: #f9f7f1; --border: #d4d0c8; --accent: #1a1a1a; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Georgia', serif; background: var(--paper); color: var(--ink); min-height: 100vh; }
header { border-bottom: 2px solid var(--ink); padding: 16px 20px; display: flex; align-items: center; gap: 12px; }
header h1 { font-size: 1rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; font-family: monospace; }
.badge { background: var(--ink); color: var(--paper); font-size: 9px; font-family: monospace; font-weight: 700; text-transform: uppercase; padding: 2px 6px; letter-spacing: 0.1em; }
.search-bar { padding: 12px 16px; border-bottom: 2px solid var(--border); display: flex; gap: 8px; align-items: center; }
.search-bar input { flex: 1; border: 2px solid var(--border); padding: 8px 12px; font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; background: var(--paper); color: var(--ink); outline: none; }
.search-bar input:focus { border-color: var(--ink); }
.search-bar label { font-size: 9px; font-family: monospace; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #888; white-space: nowrap; }
.sessions { padding: 16px; display: flex; flex-direction: column; gap: 8px; }
.session-card { border: 2px solid var(--border); padding: 14px 16px; cursor: pointer; text-decoration: none; color: inherit; display: block; transition: border-color 0.1s; }
.session-card:hover { border-color: var(--ink); }
.session-card.hidden { display: none; }
.session-title { font-size: 11px; font-weight: 700; font-family: monospace; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
.session-meta { font-size: 9px; font-family: monospace; color: #666; }
.no-results { display: none; padding: 32px 16px; text-align: center; font-size: 10px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.1em; color: #888; }
.messages { padding: 16px; display: flex; flex-direction: column; gap: 12px; max-width: 680px; margin: 0 auto; }
.bubble { padding: 12px 16px; border: 2px solid var(--border); font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.bubble.user { border-color: var(--ink); background: var(--ink); color: var(--paper); align-self: flex-end; max-width: 80%; border-radius: 12px 2px 12px 12px; }
.bubble.assistant { border-color: var(--border); background: var(--paper); align-self: flex-start; max-width: 85%; border-radius: 2px 12px 12px 12px; }
.role-label { font-size: 8px; font-family: monospace; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px; opacity: 0.6; }
a.back { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; color: var(--ink); text-decoration: none; padding: 10px 16px; border-bottom: 2px solid var(--border); }
footer { border-top: 2px solid var(--border); padding: 12px 20px; font-size: 9px; font-family: monospace; color: #888; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 24px; }
`;

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d ago`;
  const h = Math.floor(diff / 3600000);
  if (h > 0) return `${h}h ago`;
  return `${Math.floor(diff / 60000)}m ago`;
}

export async function generateMobilePortal(sessions: SessionRow[]): Promise<string> {
  const outDir = getMobileDir();
  const sessionsDir = path.join(outDir, 'sessions');
  await fs.mkdir(sessionsDir, { recursive: true });

  // Write shared CSS
  await fs.writeFile(path.join(outDir, 'style.css'), CSS.trim(), 'utf-8');

  // Build index page
  const sessionCards = sessions.map(s => {
    const msgs = JSON.parse(s.messages) as any[];
    return `
    <a class="session-card" href="sessions/${escHtml(s.id)}.html">
      <div class="session-title">${escHtml(s.title)}</div>
      <div class="session-meta">${relTime(s.updatedAt)} &middot; ${msgs.length} message${msgs.length !== 1 ? 's' : ''}</div>
    </a>`;
  }).join('\n');

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Charbot OS — Mobile Portal</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header>
    <h1>Charbot OS</h1>
    <span class="badge">Mobile Portal</span>
  </header>
  <div class="search-bar">
    <label for="search">Search:</label>
    <input id="search" type="text" placeholder="Filter sessions…" autocomplete="off" />
  </div>
  <div class="sessions" id="session-list">
    <div style="font-size:9px;font-family:monospace;text-transform:uppercase;letter-spacing:.12em;color:#888;padding:4px 0 8px;">${sessions.length} session${sessions.length !== 1 ? 's' : ''}</div>
    ${sessionCards}
    <div class="no-results" id="no-results">No sessions match your search</div>
  </div>
  <footer>Generated ${new Date().toLocaleString()} &middot; Charbot OS</footer>
<script>
(function(){
  var input = document.getElementById('search');
  var noResults = document.getElementById('no-results');
  if (!input) return;
  input.addEventListener('input', function(){
    var q = this.value.toLowerCase().trim();
    var cards = document.querySelectorAll('.session-card');
    var visible = 0;
    cards.forEach(function(card){
      var text = card.textContent.toLowerCase();
      var show = !q || text.includes(q);
      card.classList.toggle('hidden', !show);
      if (show) visible++;
    });
    if (noResults) noResults.style.display = visible === 0 ? 'block' : 'none';
  });
})();
</script>
</body>
</html>`;

  await fs.writeFile(path.join(outDir, 'index.html'), indexHtml, 'utf-8');

  // Build individual session pages
  for (const s of sessions) {
    const msgs = JSON.parse(s.messages) as any[];
    const bubbles = msgs.map(m => `
    <div class="bubble ${escHtml(m.role)}">
      <div class="role-label">${m.role === 'assistant' ? 'Charbot' : 'You'}</div>
      ${escHtml(m.content || '')}
    </div>`).join('\n');

    // P1-3: list uploaded files for this session as relative links
    let attachmentSection = '';
    try {
      const uploadsDir = path.join(outDir, '..', 'uploads', s.id);
      const uploadedFiles = await fs.readdir(uploadsDir);
      if (uploadedFiles.length > 0) {
        const links = uploadedFiles.map(f =>
          `<a href="../../uploads/${escHtml(s.id)}/${escHtml(f)}" target="_blank" class="file-link">${escHtml(f)}</a>`,
        ).join('');
        attachmentSection = `
  <div style="padding:12px 16px;border-top:2px solid var(--border);margin-top:8px">
    <div style="font-size:9px;font-family:monospace;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#888;margin-bottom:8px">Attachments</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${links}</div>
  </div>`;
      }
    } catch { /* no uploads for this session */ }

    const sessionHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escHtml(s.title)} — Charbot OS</title>
  <link rel="stylesheet" href="../style.css" />
  <style>.file-link{font-size:10px;font-family:monospace;color:var(--ink);border:1px solid var(--border);padding:3px 8px;text-decoration:none;display:inline-block}.file-link:hover{border-color:var(--ink)}</style>
</head>
<body>
  <a class="back" href="../index.html">&#8592; All Sessions</a>
  <header>
    <h1>${escHtml(s.title)}</h1>
    <span class="badge">${msgs.length} msg${msgs.length !== 1 ? 's' : ''}</span>
  </header>
  <div class="messages">
    ${bubbles || '<p style="font-family:monospace;font-size:11px;color:#888;text-align:center;padding:32px 0">No messages yet</p>'}
  </div>${attachmentSection}
  <footer>${relTime(s.updatedAt)} &middot; Charbot OS</footer>
</body>
</html>`;

    await fs.writeFile(path.join(sessionsDir, `${s.id}.html`), sessionHtml, 'utf-8');
  }

  return outDir;
}
