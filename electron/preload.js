const { contextBridge, ipcRenderer } = require('electron');

// Expose safe IPC methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  examFinished: () => ipcRenderer.invoke('exam-finished'),
  requestClose: (code) => ipcRenderer.invoke('request-close', code),
  isElectron: true,
});
