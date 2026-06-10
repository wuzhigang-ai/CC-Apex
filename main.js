const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ── Paths ──────────────────────────────────────────────────────────
const USER_DATA_DIR = app.getPath('userData');
const CONFIGS_FILE = path.join(USER_DATA_DIR, 'model-configs.json');

function getClaudeSettingsPath() {
  const home = os.homedir();
  return path.join(home, '.claude', 'settings.json');
}

// ── Configs CRUD ────────────────────────────────────────────────────
function loadConfigs() {
  try {
    if (fs.existsSync(CONFIGS_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIGS_FILE, 'utf-8'));
    }
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
  const p = getClaudeSettingsPath();
  try {
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

function applyModelConfig(modelConfig) {
  let settings = readClaudeSettings() || {};

  // Merge model-specific env vars into settings
  if (!settings.env) settings.env = {};

  if (modelConfig.apiKey) {
    settings.env.ANTHROPIC_AUTH_TOKEN = modelConfig.apiKey;
    settings.env.ANTHROPIC_API_KEY = modelConfig.apiKey;
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
  return settings;
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
    if (tray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Tray ────────────────────────────────────────────────────────────
function createTrayIcon() {
  // Generate a 16x16 gold diamond as tray icon
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = 6;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      // Diamond shape
      const inside = (dx / r + dy / r) <= 1.05;
      const edge = (dx / r + dy / r) > 0.85 && (dx / r + dy / r) <= 1.05;

      const i = (y * size + x) * 4;
      if (inside) {
        // Gold accent
        canvas[i] = 0xC9;     // R
        canvas[i + 1] = 0xA5; // G
        canvas[i + 2] = 0x5C; // B
        canvas[i + 3] = edge ? 220 : 255; // A
      }
    }
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Apex — Model Switch');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Apex', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Quit Apex', click: () => { tray = null; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => { mainWindow.show(); mainWindow.focus(); });
}

// ── IPC ─────────────────────────────────────────────────────────────
function registerIpc() {
  ipcMain.handle('get-configs', () => loadConfigs());

  ipcMain.handle('save-config', (_e, config) => {
    const configs = loadConfigs();
    if (config.id) {
      const i = configs.findIndex((c) => c.id === config.id);
      if (i >= 0) {
        configs[i] = { ...configs[i], ...config, updatedAt: Date.now() };
      } else {
        configs.push({ ...config, id: generateId(), createdAt: Date.now(), updatedAt: Date.now() });
      }
    } else {
      config.id = generateId();
      config.createdAt = Date.now();
      config.updatedAt = Date.now();
      configs.push(config);
    }
    saveConfigs(configs);
    return { success: true, configs };
  });

  ipcMain.handle('delete-config', (_e, id) => {
    let configs = loadConfigs();
    configs = configs.filter((c) => c.id !== id);
    saveConfigs(configs);
    return { success: true, configs };
  });

  ipcMain.handle('switch-model', (_e, config) => {
    try {
      const result = applyModelConfig(config);
      return { success: true, settings: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('get-current-settings', () => {
    const settings = readClaudeSettings();
    return { settings, configPath: getClaudeSettingsPath() };
  });

  ipcMain.handle('detect-claude', () => {
    const p = getClaudeSettingsPath();
    return { exists: fs.existsSync(p), path: p };
  });

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
  // Don't quit on Windows — keep running in tray
});

app.on('before-quit', () => {
  tray = null;
});
