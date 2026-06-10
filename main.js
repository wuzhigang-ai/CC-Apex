const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

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

// ── System Env Var Sync (Machine-level, all platforms) ───────────────
function syncSystemEnvVars(modelConfig) {
  if (process.platform === 'win32') return syncWindowsEnvVars(modelConfig);
  return syncUnixEnvVars(modelConfig);
}

function syncWindowsEnvVars(modelConfig) {
  const tmpDir = os.tmpdir();
  const psFile = path.join(tmpDir, 'apex-machine-sync.ps1');
  const vbsFile = path.join(tmpDir, 'apex-machine-sync.vbs');

  try {
    const lines = [];
    const addVar = (name, value) => {
      if (value) {
        lines.push(`[Environment]::SetEnvironmentVariable('${name}','${value.replace(/'/g, "''")}','Machine')`);
      } else {
        lines.push(`[Environment]::SetEnvironmentVariable('${name}',\$null,'Machine')`);
      }
    };

    if (modelConfig.modelName) addVar('ANTHROPIC_MODEL', modelConfig.modelName);
    if (modelConfig.apiKey) addVar('ANTHROPIC_API_KEY', modelConfig.apiKey);
    if (modelConfig.baseUrl) addVar('ANTHROPIC_BASE_URL', modelConfig.baseUrl);
    addVar('ANTHROPIC_AUTH_TOKEN', null);

    fs.writeFileSync(psFile, '﻿' + lines.join('\n'), 'utf-8');
    fs.writeFileSync(vbsFile,
      `CreateObject("Shell.Application").ShellExecute "powershell.exe", "-NoProfile -ExecutionPolicy Bypass -File ""${psFile.replace(/\\/g, '\\\\')}""", "", "runas", 0`,
      'utf-8'
    );

    execSync(`cscript //Nologo "${vbsFile}"`, { timeout: 30000, windowsHide: true });

    const check = execSync(
      `powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('ANTHROPIC_MODEL','Machine')"`,
      { timeout: 3000, windowsHide: true }
    ).toString().trim();

    return { success: !!check };
  } catch (_) {
    return { success: false, error: 'UAC 未通过或超时' };
  } finally {
    try { fs.unlinkSync(psFile); } catch (_) {}
    try { fs.unlinkSync(vbsFile); } catch (_) {}
  }
}

function syncUnixEnvVars(modelConfig) {
  // macOS / Linux: write /etc/profile.d/apex.sh via admin elevation
  // This file is sourced by all login shells, providing system-wide env vars
  const isMac = process.platform === 'darwin';

  try {
    const scriptContent = [
      '# Managed by Apex Model Switch — do not edit manually',
      `export ANTHROPIC_MODEL="${modelConfig.modelName || ''}"`,
      `export ANTHROPIC_API_KEY="${modelConfig.apiKey || ''}"`,
      `export ANTHROPIC_BASE_URL="${modelConfig.baseUrl || ''}"`,
      'unset ANTHROPIC_AUTH_TOKEN',
      '',
    ].join('\n');

    const tmpFile = path.join(os.tmpdir(), 'apex-profile-install');
    const installScript = [
      '#!/bin/bash',
      'mkdir -p /etc/profile.d',
      `cat > /etc/profile.d/apex.sh << 'APEX_EOF'`,
      scriptContent,
      'APEX_EOF',
      'chmod 644 /etc/profile.d/apex.sh',
    ].join('\n');

    fs.writeFileSync(tmpFile, installScript, { mode: 0o755 });

    if (isMac) {
      // macOS: osascript with administrator privileges (GUI password prompt)
      execSync(`osascript -e 'do shell script "bash ${tmpFile}" with administrator privileges'`, { timeout: 30000 });
    } else {
      // Linux: pkexec (GUI) or sudo (CLI)
      try {
        execSync(`pkexec bash ${tmpFile}`, { timeout: 30000 });
      } catch (_) {
        execSync(`sudo bash ${tmpFile}`, { timeout: 30000 });
      }
    }

    try { fs.unlinkSync(tmpFile); } catch (_) {}
    return { success: fs.existsSync('/etc/profile.d/apex.sh') };
  } catch (_) {
    try { fs.unlinkSync(path.join(os.tmpdir(), 'apex-profile-install')); } catch (_) {}
    return { success: false, error: '管理员授权未通过或超时' };
  }
}

function applyModelConfig(modelConfig) {
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
  return { settings, envResult: syncSystemEnvVars(modelConfig) };
}

// ── Auto-Start ──────────────────────────────────────────────────────
function getAutoStartStatus() {
  if (process.platform === 'win32') {
    try {
      const out = execSync(
        `powershell -NoProfile -Command "Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name '${AUTOSTART_KEY}' -ErrorAction Stop | Select-Object -ExpandProperty '${AUTOSTART_KEY}'"`,
        { timeout: 5000, windowsHide: true }
      ).toString().trim();
      return !!out;
    } catch (_) { return false; }
  }
  if (process.platform === 'darwin') {
    const plist = path.join(os.homedir(), 'Library', 'LaunchAgents', `com.apex.modelswitch.plist`);
    return fs.existsSync(plist);
  }
  return false;
}

function setAutoStart(enable) {
  if (process.platform === 'win32') {
    if (enable) {
      const exePath = process.execPath;
      execSync(
        `powershell -NoProfile -Command "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name '${AUTOSTART_KEY}' -Value '${exePath}'"`,
        { timeout: 5000, windowsHide: true }
      );
    } else {
      execSync(
        `powershell -NoProfile -Command "Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name '${AUTOSTART_KEY}' -ErrorAction SilentlyContinue"`,
        { timeout: 5000, windowsHide: true }
      );
    }
  }
  if (process.platform === 'darwin') {
    const launchDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
    const plist = path.join(launchDir, 'com.apex.modelswitch.plist');
    if (enable) {
      if (!fs.existsSync(launchDir)) fs.mkdirSync(launchDir, { recursive: true });
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.apex.modelswitch</string>
  <key>ProgramArguments</key><array><string>${process.execPath}</string></array>
  <key>RunAtLoad</key><true/>
</dict></plist>`;
      fs.writeFileSync(plist, content);
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
  updateTrayMenu();
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
      const { settings, envResult } = applyModelConfig(config);
      return {
        success: true,
        settings,
        path: p,
        envSync: envResult,
      };
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
