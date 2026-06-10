const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
// ═══════════════════════════════════════════════════════════════════
// Apex — Main Process (Production)
// ═══════════════════════════════════════════════════════════════════

const APP_NAME = 'Apex';
const APP_VERSION = '1.0.0';

// ── Paths ──────────────────────────────────────────────────────────
const USER_DATA_DIR = app.getPath('userData');
const CONFIGS_FILE = path.join(USER_DATA_DIR, 'model-configs.json');
const AUTOSTART_KEY = 'ApexModelSwitch';

function getClaudeSettingsPath() {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

// ── Configs CRUD ────────────────────────────────────────────────────
function loadConfigs() {
  try {
    if (fs.existsSync(CONFIGS_FILE)) return JSON.parse(fs.readFileSync(CONFIGS_FILE, 'utf-8'));
  } catch (_) {}
  return [];
}

function saveConfigs(configs) {
  const dir = path.dirname(CONFIGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIGS_FILE, JSON.stringify(configs, null, 2), 'utf-8');
}

// ── Claude Code Settings ────────────────────────────────────────────
function readClaudeSettings() {
  try {
    const p = getClaudeSettingsPath();
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (_) {}
  return null;
}

function writeClaudeSettings(settings) {
  const p = getClaudeSettingsPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(settings, null, 2), 'utf-8');
}

// ── Env Var Sync (macOS/Linux only) ─────────────────────────────────
// Windows: settings.json is the sole config source (Claude Code standard)
// macOS/Linux: settings.json + ~/.profile (user shell config, no password)
function syncSystemEnvVars(modelConfig) {
  if (process.platform === 'win32') return { success: true }; // Windows: no-op
  return syncUnixEnvVars(modelConfig);
}

function syncUnixEnvVars(modelConfig) {
  // macOS / Linux: write user-level shell profile (same as JAVA_HOME pattern)
  // No admin password needed. New terminal sessions auto-load ~/.profile
  const homeEnvFile = path.join(os.homedir(), '.profile');

  const marker = '# >>> Apex Model Switch (managed block) >>>';
  const endMarker = '# <<< Apex Model Switch <<<';

  const newBlock = [
    marker,
    `export ANTHROPIC_MODEL="${modelConfig.modelName || ''}"`,
    `export ANTHROPIC_API_KEY="${modelConfig.apiKey || ''}"`,
    `export ANTHROPIC_BASE_URL="${modelConfig.baseUrl || ''}"`,
    'unset ANTHROPIC_AUTH_TOKEN',
    endMarker,
    '',
  ].join('\n');

  try {
    let content = '';
    if (fs.existsSync(homeEnvFile)) {
      content = fs.readFileSync(homeEnvFile, 'utf-8');
    }

    // Replace existing Apex block, or append if not found
    const startIdx = content.indexOf(marker);
    const endIdx = content.indexOf(endMarker);

    if (startIdx !== -1 && endIdx !== -1) {
      content = content.slice(0, startIdx) + newBlock + content.slice(endIdx + endMarker.length + 1);
    } else {
      content = content.trimEnd() + '\n\n' + newBlock;
    }

    fs.writeFileSync(homeEnvFile, content, 'utf-8');
    return { success: true, path: homeEnvFile };
  } catch (_) {
    return { success: false, error: '写入 ~/.profile 失败' };
  }
}

function applyModelConfig(modelConfig) {
  // Only writes settings.json — instant, reliable, cross-platform.
  // Env var sync is fire-and-forget (see switch-model handler).
  const settings = readClaudeSettings() || {};
  if (!settings.env) settings.env = {};

  if (modelConfig.apiKey) {
    settings.env.ANTHROPIC_API_KEY = modelConfig.apiKey;
    delete settings.env.ANTHROPIC_AUTH_TOKEN;
  }
  if (modelConfig.baseUrl) {
    settings.env.ANTHROPIC_BASE_URL = modelConfig.baseUrl;
  }
  if (modelConfig.modelName) {
    settings.model = modelConfig.modelName;
  }
  if (modelConfig.timeout) {
    settings.timeout = parseInt(modelConfig.timeout, 10);
  }

  writeClaudeSettings(settings);
  return { settings };
}

// ── Auto-Start ──────────────────────────────────────────────────────
function getAutoStartStatus() {
  if (process.platform === 'win32') {
    const linkPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'Apex.lnk');
    return fs.existsSync(linkPath);
  }
  if (process.platform === 'darwin') {
    return fs.existsSync(path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.apex.modelswitch.plist'));
  }
  return false;
}

function setAutoStart(enable) {
  if (process.platform === 'win32') {
    const startupDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
    const linkPath = path.join(startupDir, 'Apex.lnk');
    if (enable) {
      if (!fs.existsSync(startupDir)) fs.mkdirSync(startupDir, { recursive: true });
      // Write a simple .bat file as launcher (Windows Startup folder doesn't need .lnk)
      fs.writeFileSync(path.join(startupDir, 'Apex.bat'), `@echo off\r\nstart "" "${process.execPath}"\r\n`, 'utf-8');
    } else {
      try { fs.unlinkSync(linkPath); } catch (_) {}
      try { fs.unlinkSync(path.join(startupDir, 'Apex.bat')); } catch (_) {}
    }
  }
  if (process.platform === 'darwin') {
    const launchDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
    const plist = path.join(launchDir, 'com.apex.modelswitch.plist');
    if (enable) {
      if (!fs.existsSync(launchDir)) fs.mkdirSync(launchDir, { recursive: true });
      fs.writeFileSync(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.apex.modelswitch</string>
  <key>ProgramArguments</key><array><string>${process.execPath}</string></array>
  <key>RunAtLoad</key><true/>
</dict></plist>`);
    } else {
      try { fs.unlinkSync(plist); } catch (_) {}
    }
  }
  return getAutoStartStatus();
}

// ── Window ──────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;

function createWindow() {
  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width: 480,
    height: 640,
    minWidth: 420,
    minHeight: 520,
    frame: false,
    ...(isMac ? { titleBarStyle: 'hidden' } : {}),
    backgroundColor: '#0a0a10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (e) => {
    if (tray) { e.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Tray ────────────────────────────────────────────────────────────
function createTrayIcon() {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4, 0);
  const cx = size / 2, cy = size / 2, r = 6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
      const inside = (dx / r + dy / r) <= 1.05;
      if (inside) {
        const i = (y * size + x) * 4;
        buf[i] = 0xC9; buf[i + 1] = 0xA5; buf[i + 2] = 0x5C; buf[i + 3] = 255;
      }
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip(`${APP_NAME} — Model Switch v${APP_VERSION}`);
  tray.on('click', () => { mainWindow.show(); mainWindow.focus(); });
  updateTrayMenu(); // Fire-and-forget async
}

function updateTrayMenu() {
  if (!tray) return;
  const autoStart = getAutoStartStatus();
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Apex', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    {
      label: 'Launch at Startup',
      type: 'checkbox',
      checked: autoStart,
      click: (mi) => { const ok = setAutoStart(mi.checked); mi.checked = ok; }
    },
    { type: 'separator' },
    { label: 'About Apex', click: () => { mainWindow.webContents.send('show-about'); mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Quit Apex', click: () => { tray = null; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
}

// ── IPC ─────────────────────────────────────────────────────────────
function registerIpc() {
  // Config CRUD
  ipcMain.handle('get-configs', () => loadConfigs());

  ipcMain.handle('save-config', (_e, config) => {
    const configs = loadConfigs();
    if (config.id) {
      const i = configs.findIndex((c) => c.id === config.id);
      if (i >= 0) configs[i] = { ...configs[i], ...config, updatedAt: Date.now() };
      else configs.push({ ...config, id: generateId(), createdAt: Date.now(), updatedAt: Date.now() });
    } else {
      config.id = generateId(); config.createdAt = Date.now(); config.updatedAt = Date.now();
      configs.push(config);
    }
    saveConfigs(configs);
    return { success: true, configs };
  });

  ipcMain.handle('delete-config', (_e, id) => {
    const configs = loadConfigs().filter((c) => c.id !== id);
    saveConfigs(configs);
    return { success: true, configs };
  });

  // Model Switch
  ipcMain.handle('switch-model', (_e, config) => {
    try {
      const p = getClaudeSettingsPath();
      const { settings } = applyModelConfig(config);
      // macOS/Linux: sync ~/.profile in background (best-effort)
      syncSystemEnvVars(config);
      return { success: true, settings, path: p };
    } catch (err) {
      return { success: false, error: `写入失败: ${err.message}` };
    }
  });

  // Claude Code detection
  ipcMain.handle('get-current-settings', () => {
    const settings = readClaudeSettings();
    return { settings, configPath: getClaudeSettingsPath() };
  });

  ipcMain.handle('detect-claude', () => {
    const p = getClaudeSettingsPath();
    return { exists: fs.existsSync(p), path: p };
  });

  // Export / Import
  ipcMain.handle('export-configs', async () => {
    const configs = loadConfigs();
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Model Configurations',
      defaultPath: `apex-configs-${Date.now()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!result.canceled && result.filePath) {
      // Strip sensitive keys for safe export
      const safe = configs.map(({ apiKey, ...rest }) => ({ ...rest, apiKey: apiKey ? '***REDACTED***' : '' }));
      fs.writeFileSync(result.filePath, JSON.stringify(safe, null, 2), 'utf-8');
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });

  ipcMain.handle('import-configs', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Model Configurations',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (!result.canceled && result.filePaths[0]) {
      try {
        const imported = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
        if (!Array.isArray(imported)) throw new Error('Invalid format');
        const existing = loadConfigs();
        const merged = [...existing];
        imported.forEach((c) => {
          // Avoid duplicates
          if (!merged.find((e) => e.name === c.name)) {
            merged.push({ ...c, id: generateId(), createdAt: Date.now(), updatedAt: Date.now() });
          }
        });
        saveConfigs(merged);
        return { success: true, configs: merged, count: merged.length - existing.length };
      } catch (err) {
        return { success: false, error: `导入失败: ${err.message}` };
      }
    }
    return { success: false };
  });

  // Auto-start
  ipcMain.handle('get-autostart', () => getAutoStartStatus());
  ipcMain.handle('set-autostart', (_e, enable) => {
    const ok = setAutoStart(enable);
    updateTrayMenu();
    return ok;
  });

  // App info
  ipcMain.handle('get-app-info', () => ({
    name: APP_NAME,
    version: APP_VERSION,
    platform: process.platform,
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
  }));

  // Window controls
  ipcMain.handle('window-minimize', () => mainWindow.minimize());
  ipcMain.handle('window-close', () => mainWindow.close());
}

function generateId() {
  return 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ── App Lifecycle ───────────────────────────────────────────────────
app.whenReady().then(() => {
  registerIpc();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (mainWindow) mainWindow.show();
    else createWindow();
  });
});

app.on('window-all-closed', () => {
  // Keep running in tray on Windows
});

app.on('before-quit', () => {
  tray = null;
});
