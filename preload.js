const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('apex', {
  // Config CRUD
  getConfigs: () => ipcRenderer.invoke('get-configs'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  deleteConfig: (id) => ipcRenderer.invoke('delete-config', id),

  // Model switching
  switchModel: (config) => ipcRenderer.invoke('switch-model', config),
  getCurrentSettings: () => ipcRenderer.invoke('get-current-settings'),
  detectClaude: () => ipcRenderer.invoke('detect-claude'),

  // Import / Export
  exportConfigs: () => ipcRenderer.invoke('export-configs'),
  importConfigs: () => ipcRenderer.invoke('import-configs'),

  // Auto-start
  getAutoStart: () => ipcRenderer.invoke('get-autostart'),
  setAutoStart: (enable) => ipcRenderer.invoke('set-autostart', enable),

  // App info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),

  // Event listeners
  onShowAbout: (callback) => {
    ipcRenderer.on('show-about', () => callback());
    return () => ipcRenderer.removeAllListeners('show-about');
  },
});
