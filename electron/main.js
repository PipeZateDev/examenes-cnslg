const { app, BrowserWindow, globalShortcut, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const http = require('http');

const NEXT_PORT = 3001;
const NEXT_URL = `http://localhost:${NEXT_PORT}`;
const CLOSE_CODE_ENDPOINT = `${NEXT_URL}/api/admin/verificar-codigo`;

let mainWindow = null;
let isLocked = false; // True while exam is in progress (kiosk mode)

// ─── Wait for Next.js to be ready ────────────────────────────────────────────
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

// ─── Verify close code against server ────────────────────────────────────────
async function verifyCloseCode(code) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ codigo: code });
    const options = {
      hostname: 'localhost',
      port: NEXT_PORT,
      path: '/api/admin/verificar-codigo',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data).valid === true); }
        catch { resolve(false); }
      });
    });
    req.on('error', () => resolve(false));
    req.write(postData);
    req.end();
  });
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
    icon: path.join(__dirname, 'public', 'logo-cnslg.png'),
  });

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

  // Load Next.js
  try {
    await waitForNext();
    mainWindow.loadURL(`${NEXT_URL}/examen/login`);
    isLocked = true;
  } catch {
    dialog.showErrorBox('Error', 'No se pudo conectar al servidor de la aplicación.');
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

// IPC: request close (admin wants to close from another PC)
ipcMain.handle('request-close', async (event, code) => {
  const valid = await verifyCloseCode(code);
  if (valid) {
    isLocked = false;
    app.quit();
  }
  return { valid };
});
