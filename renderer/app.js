// ═══════════════════════════════════════════════════════════════════
// Apex — Application Logic (Production)
// ═══════════════════════════════════════════════════════════════════

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── State ─────────────────────────────────────────────────────────
let configs = [];
let activeConfigId = null;
let editingConfigId = null;
let pendingDeleteId = null;

// ── DOM Refs ──────────────────────────────────────────────────────
const emptyState = $('#empty-state');
const configList = $('#config-list');
const configCards = $('#config-cards');
const statusBar = $('#status-bar');
const statusText = $('.status-text');
const modalOverlay = $('#modal-overlay');
const modalTitle = $('#modal-title');
const configForm = $('#config-form');
const confirmOverlay = $('#confirm-overlay');
const aboutOverlay = $('#about-overlay');
const aboutInfo = $('#about-info');

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupTitlebar();
  setupModal();
  setupConfirm();
  setupAbout();
  setupImportExport();
  await loadConfigs();
  await checkCurrentSettings();
  await loadAppInfo();
});

// ── Title Bar ─────────────────────────────────────────────────────
function setupTitlebar() {
  $('#btn-minimize').addEventListener('click', () => window.apex.minimizeWindow());
  $('#btn-close').addEventListener('click', () => window.apex.closeWindow());
}

// ── Data ──────────────────────────────────────────────────────────
async function loadConfigs() {
  configs = await window.apex.getConfigs();
  render();
}

async function checkCurrentSettings() {
  try {
    const { settings } = await window.apex.getCurrentSettings();
    if (settings && settings.model) {
      const match = configs.find((c) => {
        return c.modelName === settings.model ||
          (settings.env && (
            settings.env.ANTHROPIC_API_KEY === c.apiKey ||
            settings.env.ANTHROPIC_BASE_URL === c.baseUrl
          ));
      });
      if (match) activeConfigId = match.id;
    }
  } catch (_) {}
}

async function loadAppInfo() {
  try {
    const info = await window.apex.getAppInfo();
    if (info && aboutInfo) {
      aboutInfo.innerHTML = `<span class="about-meta">版本 ${info.version} · Electron ${info.electron} · ${info.platform === 'win32' ? 'Windows' : info.platform === 'darwin' ? 'macOS' : info.platform}</span>`;
    }
  } catch (_) {}
}

// ── Render ────────────────────────────────────────────────────────
function render() {
  if (configs.length === 0) {
    emptyState.classList.remove('hidden');
    configList.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  configList.classList.remove('hidden');

  configCards.innerHTML = configs.map((c) => {
    const isActive = c.id === activeConfigId;
    return `
      <div class="config-card ${isActive ? 'active' : ''}" data-id="${c.id}">
        <div class="card-indicator"></div>
        <div class="card-info">
          <div class="card-name">${escapeHtml(c.name)}</div>
          <div class="card-meta">
            <span class="meta-label">模型</span><span>${escapeHtml(c.modelName || '—')}</span>
            ${c.baseUrl ? `<span class="meta-label">端点</span><span>${escapeHtml(c.baseUrl)}</span>` : ''}
          </div>
        </div>
        <span class="card-badge">${isActive ? '当前' : '备用'}</span>
        <div class="card-actions">
          <button class="btn-icon switch" data-action="switch" data-id="${c.id}" title="一键启用">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            启用
          </button>
          <button class="btn-icon" data-action="edit" data-id="${c.id}" title="编辑">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-icon danger" data-action="delete" data-id="${c.id}" title="删除">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  configCards.removeEventListener('click', handleCardClick);
  configCards.addEventListener('click', handleCardClick);
}

function handleCardClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  switch (btn.dataset.action) {
    case 'switch': handleSwitch(id); break;
    case 'edit': openEditor(id); break;
    case 'delete': confirmDelete(id); break;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Switch Model ─────────────────────────────────────────────────
async function handleSwitch(id) {
  const config = configs.find((c) => c.id === id);
  if (!config) return;

  const card = document.querySelector(`[data-id="${id}"]`);
  card.classList.add('switching');
  showStatus('info', '正在切换模型配置...');

  const result = await window.apex.switchModel({
    apiKey: config.apiKey || undefined,
    baseUrl: config.baseUrl || undefined,
    modelName: config.modelName || undefined,
    timeout: config.timeout || undefined,
  });

  card.classList.remove('switching');

  if (result.success) {
    activeConfigId = id;
    render();
    const sync = result.envSync || {};
    const parts = ['settings.json ✅'];
    if (sync.user !== false) parts.push('用户环境变量 ✅');
    if (sync.machine) parts.push('系统环境变量 ✅');
    else if (sync.user === false) parts.push('环境变量写入失败 ⚠️');
    showStatus('success', `已切换至「${escapeHtml(config.name)}」→ ${escapeHtml(config.modelName)} · 新终端生效 (${parts.join(' · ')})`);
    setTimeout(hideStatus, 6000);
  } else {
    showStatus('error', `切换失败：${result.error}`);
    setTimeout(hideStatus, 5000);
  }
}

// ── CRUD ─────────────────────────────────────────────────────────
async function saveConfig(e) {
  e.preventDefault();

  const id = $('#form-id').value;
  const name = $('#form-name').value.trim();
  const modelName = $('#form-model').value.trim();
  const apiKey = $('#form-key').value.trim();
  const baseUrl = $('#form-url').value.trim();
  const timeout = $('#form-timeout').value.trim();

  if (!name || !modelName) {
    showStatus('error', '方案名称和模型名称为必填项');
    setTimeout(hideStatus, 3000);
    return;
  }

  const config = { id: id || undefined, name, modelName, apiKey, baseUrl, timeout };
  const result = await window.apex.saveConfig(config);

  if (result.success) {
    configs = result.configs;
    closeModal();
    render();
    showStatus('success', id ? '方案已更新' : '新方案已创建');
    setTimeout(hideStatus, 2500);
  } else {
    showStatus('error', '保存失败，请重试');
    setTimeout(hideStatus, 3000);
  }
}

function openEditor(id) {
  const config = configs.find((c) => c.id === id);
  if (!config) return;
  editingConfigId = id;
  modalTitle.textContent = '编辑备用方案';
  $('#form-id').value = config.id;
  $('#form-name').value = config.name || '';
  $('#form-model').value = config.modelName || '';
  $('#form-key').value = config.apiKey || '';
  $('#form-url').value = config.baseUrl || '';
  $('#form-timeout').value = config.timeout || '';
  modalOverlay.classList.remove('hidden');
  $('#form-name').focus();
}

function openCreator() {
  editingConfigId = null;
  modalTitle.textContent = '新增备用方案';
  configForm.reset();
  $('#form-id').value = '';
  modalOverlay.classList.remove('hidden');
  $('#form-name').focus();
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  editingConfigId = null;
}

function confirmDelete(id) {
  pendingDeleteId = id;
  const config = configs.find((c) => c.id === id);
  $('#confirm-text').textContent = `确定要删除「${config ? config.name : ''}」吗？此操作不可撤销。`;
  confirmOverlay.classList.remove('hidden');
}

async function executeDelete() {
  if (!pendingDeleteId) return;
  const result = await window.apex.deleteConfig(pendingDeleteId);
  if (result.success) {
    configs = result.configs;
    if (activeConfigId === pendingDeleteId) activeConfigId = null;
    closeConfirm();
    render();
    showStatus('success', '方案已删除');
    setTimeout(hideStatus, 2500);
  }
  pendingDeleteId = null;
}

function closeConfirm() {
  confirmOverlay.classList.add('hidden');
  pendingDeleteId = null;
}

// ── Export / Import ──────────────────────────────────────────────
function setupImportExport() {
  $('#btn-export').addEventListener('click', async () => {
    const result = await window.apex.exportConfigs();
    if (result.success) {
      showStatus('success', `配置已导出 (API 密钥已脱敏)`);
      setTimeout(hideStatus, 3000);
    }
  });

  $('#btn-import').addEventListener('click', async () => {
    const result = await window.apex.importConfigs();
    if (result.success) {
      configs = result.configs;
      render();
      showStatus('success', `已导入 ${result.count || 0} 个新方案`);
      setTimeout(hideStatus, 3000);
    } else if (result.error) {
      showStatus('error', result.error);
      setTimeout(hideStatus, 4000);
    }
  });
}

// ── About ────────────────────────────────────────────────────────
function setupAbout() {
  $('#about-close').addEventListener('click', () => aboutOverlay.classList.add('hidden'));
  aboutOverlay.addEventListener('click', (e) => {
    if (e.target === aboutOverlay) aboutOverlay.classList.add('hidden');
  });

  // Listen for tray menu about trigger
  window.apex.onShowAbout(() => {
    aboutOverlay.classList.remove('hidden');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !aboutOverlay.classList.contains('hidden')) {
      aboutOverlay.classList.add('hidden');
    }
  });
}

// ── Modal Setup ──────────────────────────────────────────────────
function setupModal() {
  $('#btn-add').addEventListener('click', openCreator);
  $('#btn-empty-add').addEventListener('click', openCreator);
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal-cancel').addEventListener('click', closeModal);
  configForm.addEventListener('submit', saveConfig);

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  $('#toggle-key').addEventListener('click', () => {
    const input = $('#form-key');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!modalOverlay.classList.contains('hidden')) closeModal();
      if (!confirmOverlay.classList.contains('hidden')) closeConfirm();
    }
  });
}

function setupConfirm() {
  $('#confirm-cancel').addEventListener('click', closeConfirm);
  $('#confirm-ok').addEventListener('click', executeDelete);
  confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) closeConfirm();
  });
}

// ── Status ───────────────────────────────────────────────────────
function showStatus(type, message) {
  statusBar.className = `status-bar ${type}`;
  statusText.textContent = message;
  statusBar.classList.remove('hidden');
}

function hideStatus() {
  statusBar.classList.add('hidden');
}
