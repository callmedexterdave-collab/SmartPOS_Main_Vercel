import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('nativeApi', {
  dbPing: async () => ipcRenderer.invoke('db:ping'),
  // DB methods will be added here (query, run, migrate, etc.)
});
