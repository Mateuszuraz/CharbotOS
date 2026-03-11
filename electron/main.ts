import { app, BrowserWindow, shell, dialog } from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Must be set BEFORE importing the server bundle
process.env.NODE_ENV = 'production';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SERVER_PORT = 3000;
const APP_URL = `http://127.0.0.1:${SERVER_PORT}`;

// Resolve path to bundled server
function getServerPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app', 'dist-server', 'server.mjs');
  }
  return path.join(__dirname, '..', 'dist-server', 'server.mjs');
}

async function waitForServer(maxMs = 20_000): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${APP_URL}/api/config`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error(`Server did not start within ${maxMs / 1000}s`);
}

async function createWindow(): Promise<void> {
  const serverPath = getServerPath();
  console.log('[main] Loading server bundle…', serverPath);
  try {
    await import(pathToFileURL(serverPath).href);
  } catch (err: any) {
    console.error('[main] Failed to load server bundle:', err);
    dialog.showErrorBox('Charbot OS — błąd startu serwera', `Nie udało się załadować serwera.\n\nŚcieżka: ${serverPath}\n\nBłąd:\n${err?.message ?? err}\n\nStack:\n${err?.stack ?? '(brak)'}`);
    app.quit();
    return;
  }

  // Server is already listening (top-level await in server.mjs), but do a quick HTTP ping
  // in case something is still initialising routes.
  console.log('[main] Verifying server HTTP on :3000…');
  try {
    await waitForServer(5_000);
  } catch (err: any) {
    console.error('[main] Server HTTP check failed:', err);
    dialog.showErrorBox('Charbot OS — serwer nie odpowiada', `Serwer uruchomił się, ale nie odpowiada na HTTP.\n\nBłąd: ${err?.message ?? err}\n\nSprawdź czy port 3000 nie jest zajęty przez inny proces.`);
    app.quit();
    return;
  }

  console.log('[main] Server ready — creating window');
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    title: 'Charbot OS',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(path.dirname(fileURLToPath(import.meta.url)), 'preload.cjs'),
    },
    // Remove default frame on Windows/Linux for a cleaner look (optional)
    // frame: false,
  });

  // Open external links in the system browser, not in Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  console.log('[main] Loading URL:', APP_URL);
  try {
    await win.loadURL(APP_URL);
    console.log('[main] URL loaded OK');
  } catch (err) {
    console.error('[main] loadURL failed:', err);
  }

  createBuddyWindow();
}

function createBuddyWindow(): BrowserWindow {
  const buddy = new BrowserWindow({
    width: 260,
    height: 320,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  buddy.setIgnoreMouseEvents(false);
  buddy.loadURL(`${APP_URL}/buddy`);
  return buddy;
}

// Single instance lock — prevent two Charbot OS processes competing for port 3000
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// Safety net: catch any unhandled rejections not covered by the import() try-catch
process.on('unhandledRejection', (reason: any) => {
  console.error('[main] Unhandled rejection:', reason);
  const msg = reason?.message ?? String(reason);
  const stack = reason?.stack ?? '';
  dialog.showErrorBox('Charbot OS — błąd serwera (async)', `Serwer zgłosił nieobsłużony błąd:\n\n${msg}\n\n${stack.slice(0, 600)}`);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
