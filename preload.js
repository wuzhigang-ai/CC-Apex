const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('apex', {
  getConfigs: () => ipcRenderer.invoke('get-configs'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  deleteConfig: (id) => ipcRenderer.invoke('delete-config', id),
  switchModel: (config) => ipcRenderer.invoke('switch-model', config),
  getCurrentSettings: () => ipcRenderer.invoke('get-current-settings'),
  detectClaude: () => ipcRenderer.invoke('detect-claude'),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
});
