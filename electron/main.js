const { app, BrowserWindow, globalShortcut, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const http = require('http');

const NEXT_PORT = 3001;
const DEFAULT_URL = app.isPackaged || process.env.NODE_ENV === 'production'
  ? 'https://examenes-cnslg.vercel.app'
  : `http://localhost:${NEXT_PORT}`;

const NEXT_URL = process.env.EXAMENES_WEB_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_URL || DEFAULT_URL;

let mainWindow = null;
let isLocked = false; // True while exam is in progress (kiosk mode)

// ─── Wait for Next.js to be ready (local mode only) ─────────────────────────
function waitForNext(retries = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      const req = http.get(NEXT_URL, (res) => {
        if (res.statusCode < 500) resolve();
        else { attempts++; if (attempts >= retries) reject(); else setTimeout(check, 1000); }
      });
      req.on('error', () => {
        attempts++;
        if (attempts >= retries) reject(new Error('Next.js no respondió'));
        else setTimeout(check, 1000);
      });
    };
    check();
  });
}

// ─── Verify close code against server (works for local and Vercel/HTTPS) ─────
async function verifyCloseCode(code) {
  try {
    const res = await fetch(`${NEXT_URL}/api/admin/verificar-codigo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CNSLG-Desktop-App/1.0'
      },
      body: JSON.stringify({ codigo: code }),
    });
    const data = await res.json();
    return data.valid === true;
  } catch (err) {
    console.error('Error verifying close code:', err);
    return false;
  }
}

// ─── Show close code prompt ───────────────────────────────────────────────────
async function promptCloseCode(reason = 'cerrar') {
  if (!mainWindow) return;
  
  const result = await dialog.showInputBox
    ? dialog.showInputBox({ message: '' })  // fallback
    : null;

  // Use custom dialog via preload instead
  mainWindow.webContents.executeJavaScript(`
    (function() {
      const code = prompt('🔐 Código de ${reason === 'cerrar' ? 'cierre' : 'administrador'} (6 dígitos):\\n\\nContacta al administrador del sistema para obtenerlo.');
      return code;
    })()
  `).then(async (code) => {
    if (!code) return;
    const valid = await verifyCloseCode(code.trim());
    if (valid) {
      isLocked = false;
      if (reason === 'cerrar') {
        app.quit();
      }
    } else {
      mainWindow.webContents.executeJavaScript(`
        alert('❌ Código incorrecto. Contacta al administrador.');
      `);
    }
  });
}

// ─── Create window ────────────────────────────────────────────────────────────
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    kiosk: true,                  // Full kiosk mode
    alwaysOnTop: true,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '..', 'public', 'icon.ico'),
  });

  // Set custom user agent identifying the official desktop application
  const defaultUA = mainWindow.webContents.getUserAgent();
  mainWindow.webContents.setUserAgent(`${defaultUA} CNSLG-Desktop-App/1.0`);

  // Block navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(NEXT_URL) && !url.startsWith('http://localhost:')) {
      event.preventDefault();
    }
  });

  // Block new window/tab creation
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Intercept close to ask for code if locked
  mainWindow.on('close', async (event) => {
    if (isLocked) {
      event.preventDefault();
      await promptCloseCode('cerrar');
    }
  });

  // Load Next.js (wait if local, or load remote directly)
  try {
    if (NEXT_URL.includes('localhost') || NEXT_URL.includes('127.0.0.1')) {
      await waitForNext();
    }
    mainWindow.loadURL(`${NEXT_URL}/examen/login`);
    isLocked = true;
  } catch (err) {
    dialog.showErrorBox('Error', `No se pudo conectar al servidor de la aplicación (${NEXT_URL}).`);
    app.quit();
  }
}

// ─── Electron app events ──────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Block ALL dangerous shortcuts
  const blockedShortcuts = [
    'Alt+F4', 'Super+D', 'Super+M', 'Super+L',
    'Ctrl+Alt+Delete', 'Alt+Tab', 'Alt+Escape',
    'Ctrl+W', 'Ctrl+Q', 'Ctrl+F4',
    'F11', 'Escape',
  ];

  blockedShortcuts.forEach(shortcut => {
    try {
      globalShortcut.register(shortcut, () => {
        if (isLocked) {
          // Intercept and show code prompt for F4 / Escape requests
          if (['Alt+F4', 'Ctrl+W', 'Ctrl+Q', 'Escape', 'F11'].includes(shortcut)) {
            promptCloseCode('cerrar');
          }
          // Just block the rest silently
        }
      });
    } catch (_) { /* Some shortcuts can't be registered */ }
  });

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});

// IPC: from renderer, unlock if exam finished normally
ipcMain.handle('exam-finished', async () => {
  isLocked = false;
  return { ok: true };
});

// IPC: close app immediately from renderer when exam is submitted / finished
ipcMain.handle('close-app', async () => {
  isLocked = false;
  app.quit();
  return { ok: true };
});

// IPC: request close (admin wants to close from another PC)
ipcMain.handle('request-close', async (event, code) => {
  const valid = await verifyCloseCode(code);
  if (valid) {
    isLocked = false;
    app.quit();
  }
  return { valid };
});
