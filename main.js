const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

// ═══════════════════════════════════════════════════════════════════
// Apex — Main Process (Production)
// ═══════════════════════════════════════════════════════════════════

const APP_NAME = 'Apex';
const APP_VERSION = '1.0.0';

// ── Windows Subprocess ──────────────────────────────────────────────
// ALL external calls use async execFile — never spawnSync (blocks main
// thread → deadlock with Windows message loop in Electron)
function runFile(file, args, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (result) => { if (!settled) { settled = true; resolve(result); } };

    // Manual timeout: execFile timeout is unreliable on Windows
    const timer = setTimeout(() => done({ error: new Error('ETIMEDOUT'), stdout: '', stderr: '' }), timeoutMs + 5000);

    execFile(file, args, { timeout: timeoutMs, windowsHide: true }, (err, stdout, stderr) => {
      clearTimeout(timer);
      done({ error: err, stdout: (stdout || '').trim(), stderr: (stderr || '').trim() });
    });
  });
}

function runCscript(vbsContent) {
  // Write VBScript to temp file, execute via cscript, return Promise
  const f = path.join(os.tmpdir(), `apex-${Date.now().toString(36)}.vbs`);
  return new Promise((resolve) => {
    try { fs.writeFileSync(f, vbsContent, 'utf-8'); } catch (e) { return resolve({ error: e }); }
    execFile('cscript.exe', ['//Nologo', f], { timeout: 10000, windowsHide: true }, (err, stdout) => {
      try { fs.unlinkSync(f); } catch (_) {}
      resolve({ error: err, stdout: (stdout || '').trim() });
    });
  });
}

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

// ── System Env Var Sync (all platforms) ─────────────────────────────
// Windows: Machine-level (system) env vars via elevated PowerShell + UAC
// macOS/Linux: ~/.profile user shell config (same as JAVA_HOME)
async function syncSystemEnvVars(modelConfig) {
  if (process.platform === 'win32') return syncWindowsMachineEnvVars(modelConfig);
  return syncUnixEnvVars(modelConfig);
}

async function syncWindowsMachineEnvVars(modelConfig) {
  // Strategy: launch elevated PowerShell via VBS ShellExecute (fire-and-forget),
  // then poll Machine env vars until they match expected values.
  // NO Start-Process -Wait — that hangs execFile indefinitely on Windows.
  const baseName = `apex-m-${Date.now().toString(36)}`;
  const psFile = path.join(os.tmpdir(), baseName + '.ps1');
  const vbsFile = path.join(os.tmpdir(), baseName + '.vbs');

  try {
    const lines = [];
    if (modelConfig.modelName) {
      lines.push(`[Environment]::SetEnvironmentVariable('ANTHROPIC_MODEL','${modelConfig.modelName.replace(/'/g, "''")}','Machine')`);
    }
    if (modelConfig.apiKey) {
      lines.push(`[Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY','${modelConfig.apiKey.replace(/'/g, "''")}','Machine')`);
    }
    if (modelConfig.baseUrl) {
      lines.push(`[Environment]::SetEnvironmentVariable('ANTHROPIC_BASE_URL','${modelConfig.baseUrl.replace(/'/g, "''")}','Machine')`);
    }
    lines.push(`[Environment]::SetEnvironmentVariable('ANTHROPIC_AUTH_TOKEN','','Machine')`);
    fs.writeFileSync(psFile, '﻿' + lines.join('\n'), 'utf-8');

    // VBScript ShellExecute("runas") → triggers UAC, returns immediately
    fs.writeFileSync(vbsFile,
      `CreateObject("Shell.Application").ShellExecute "powershell.exe", "-NoProfile -ExecutionPolicy Bypass -File ""${psFile}""", "", "runas", 0`,
      'utf-8'
    );
    await runFile('cscript.exe', ['//Nologo', vbsFile], 10000);

    // Cleanup temp files
    try { fs.unlinkSync(psFile); } catch (_) {}
    try { fs.unlinkSync(vbsFile); } catch (_) {}

    // Poll Machine env vars — up to 60 times × 2s = 2 min
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const { stdout } = await runFile('powershell.exe', [
          '-NoProfile', '-Command',
          '[Environment]::GetEnvironmentVariable(\'ANTHROPIC_MODEL\',\'Machine\')'
        ], 5000);
        if (stdout.trim() === (modelConfig.modelName || '')) return { success: true };
      } catch (_) {}
    }

    return { success: false, error: '超时：Machine 变量未在 2 分钟内更新' };

  } catch (_) {
    try { fs.unlinkSync(psFile); } catch (_) {}
    try { fs.unlinkSync(vbsFile); } catch (_) {}
    return { success: false, error: '系统环境变量写入异常' };
  }
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
const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

async function getAutoStartStatus() {
  if (process.platform === 'win32') {
    const { stdout } = await runFile('cmd.exe', [
      '/c', 'reg', 'query', RUN_KEY, '/v', AUTOSTART_KEY
    ], 5000);
    return stdout.includes(AUTOSTART_KEY);
  }
  if (process.platform === 'darwin') {
    return fs.existsSync(path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.apex.modelswitch.plist'));
  }
  return false;
}

async function setAutoStart(enable) {
  if (process.platform === 'win32') {
    if (enable) {
      await runFile('cmd.exe', [
        '/c', 'reg', 'add', RUN_KEY, '/v', AUTOSTART_KEY, '/t', 'REG_SZ', '/d', process.execPath, '/f'
      ], 5000);
    } else {
      await runFile('cmd.exe', [
        '/c', 'reg', 'delete', RUN_KEY, '/v', AUTOSTART_KEY, '/f'
      ], 5000);
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

async function updateTrayMenu() {
  if (!tray) return;
  const autoStart = await getAutoStartStatus();
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Apex', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    {
      label: 'Launch at Startup',
      type: 'checkbox',
      checked: autoStart,
      click: async (mi) => { const ok = await setAutoStart(mi.checked); mi.checked = ok; }
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
  // Phase 1 (instant): write settings.json → return success to UI
  // Phase 2 (background): sync system env vars → best-effort, non-blocking
  ipcMain.handle('switch-model', async (_e, config) => {
    try {
      const p = getClaudeSettingsPath();
      const { settings } = applyModelConfig(config);

      // Fire-and-forget: env var sync in background
      syncSystemEnvVars(config).then((envResult) => {
        if (mainWindow) {
          mainWindow.webContents.send('env-sync-result', {
            success: envResult.success,
            error: envResult.error,
          });
        }
      });

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
  ipcMain.handle('get-autostart', async () => await getAutoStartStatus());
  ipcMain.handle('set-autostart', async (_e, enable) => {
    const ok = await setAutoStart(enable);
    await updateTrayMenu();
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
