const { contextBridge, ipcRenderer } = require('electron');

// Expose safe IPC methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  examFinished: () => ipcRenderer.invoke('exam-finished'),
  requestClose: (code) => ipcRenderer.invoke('request-close', code),
  closeApp: () => ipcRenderer.invoke('close-app'),
  isElectron: true,
});

