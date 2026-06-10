<div align="center">

![Apex](https://img.shields.io/badge/Apex-CC%20Model%20Switch-c9a55c?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWdvbiBwb2ludHM9IjEyIDIgMjIgMjAgMiAyMCIvPjxsaW5lIHgxPSIxMiIgeTE9IjkiIHgyPSIxMiIgeTI9IjE3Ii8+PGxpbmUgeDE9IjgiIHkxPSIxNSIgeDI9IjE2IiB5Mj0iMTUiLz48L3N2Zz4=)

# Apex — Claude Code 模型快速切换

**多模型备用留存，一键切换，即刻生效**

[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-6b8cff?style=flat-square)](https://github.com/wuzhigang-ai/CC-Apex)
[![Electron](https://img.shields.io/badge/electron-33-47848f?style=flat-square&logo=electron)](https://electronjs.org)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-c9a55c?style=flat-square)](https://github.com/wuzhigang-ai/CC-Apex/releases)

</div>

---

## 缘起

Claude Code 是当下最锋利的 AI 编程工具。但每一次切换模型——从 Opus 那深思熟虑的架构师，到 Sonnet 那行云流水的工程师，再到 Haiku 那闪电般的执行者——都需要手动翻找配置文件、修改参数、填入密钥。

**这不应该。**

于是有了 Apex。

它不是一个大而全的平台，而是一把精准的手术刀——只做一件事，做到极致：**让你的 Claude Code 模型切换，从三十秒变成一秒钟。**

---

## 哲学

> *"Simplicity is the ultimate sophistication."* — Leonardo da Vinci

Apex 信奉三个原则：

**零冗余。** 没有云端同步、没有团队协作、没有数据统计。你的配置永远留在本地，你的密钥永远不会离开你的机器。

**零摩擦。** 打开 Apex，点击一个按钮，关闭。三秒完成。不需要阅读文档，不需要学习概念，直觉即操作。

**零侵入。** Apex 只读写 `~/.claude/settings.json`——Claude Code 官方指定的唯一配置文件。不注入进程，不篡改程序，不留下痕迹。

---

## 体验

<div align="center">

```
┌─────────────────────────────────────────┐
│  ◆ Apex  │  v1.0                  ─ □ ✕ │
├─────────────────────────────────────────┤
│                                         │
│  备用模型方案                    + 新增  │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ ● DeepSeek V4 Pro        [当前] │    │
│  │   模型 deepseek-v4-pro[1m]      │    │
│  │   端点 api.deepseek.com    [启用]│    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ ○ DeepSeek Flash           [备用]│    │
│  │   模型 deepseek-chat       [启用]│    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

*深炭黑曜石基底 · 香槟金点缀 · 内敛与力量的平衡*

</div>

---

## 开始

### 下载安装

| 平台 | 包格式 | 下载 |
|------|--------|------|
| **Windows** | `.exe` 安装包 | [Apex-Setup-1.0.0.exe](https://github.com/wuzhigang-ai/CC-Apex/releases/latest) |
| **macOS** Intel | `.dmg` | [Apex-1.0.0-x64.dmg](https://github.com/wuzhigang-ai/CC-Apex/releases/latest) |
| **macOS** Apple Silicon | `.dmg` | [Apex-1.0.0-arm64.dmg](https://github.com/wuzhigang-ai/CC-Apex/releases/latest) |
| **Linux** | `.AppImage` | [Apex-1.0.0.AppImage](https://github.com/wuzhigang-ai/CC-Apex/releases/latest) |
| **Linux** | `.deb` | [apex-1.0.0-amd64.deb](https://github.com/wuzhigang-ai/CC-Apex/releases/latest) |

### 前提

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 已安装
- `~/.claude/settings.json` 存在（正常使用过 Claude Code 即已存在）

### 源码构建

```bash
git clone https://github.com/wuzhigang-ai/CC-Apex.git
cd CC-Apex
npm install
npm start          # 开发运行
npm run dist:win   # 构建 Windows 安装包
npm run dist:mac   # 构建 macOS DMG
npm run dist:linux # 构建 Linux 包
```

---

## 技术架构

```
┌──────────────────────────────────────┐
│              Apex.app                │
│                                     │
│  ┌──────────┐    ┌───────────────┐  │
│  │ Renderer │◄───│  Preload (IPC)│  │
│  │ HTML/CSS │    │  contextBridge│  │
│  │ Premium UI│   └───────┬───────┘  │
│  └──────────┘           │          │
│                         │          │
│  ┌──────────────────────▼────────┐  │
│  │        Main Process           │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │  applyModelConfig()     │  │  │
│  │  │  └─ fs.writeFileSync()  │  │  │
│  │  │     ~/.claude/           │  │  │
│  │  │     settings.json        │  │  │
│  │  └─────────────────────────┘  │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │  syncUnixEnvVars()      │  │  │
│  │  │  └─ ~/.profile          │  │  │
│  │  │     (macOS/Linux only)  │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
│                                     │
│  Zero child_process dependencies    │
│  Pure Node.js fs operations         │
└─────────────────────────────────────┘
```

| 层级 | Windows | macOS | Linux |
|------|---------|-------|-------|
| 配置写入 | `~/.claude/settings.json` | `~/.claude/settings.json` | `~/.claude/settings.json` |
| Shell 环境 | — | `~/.profile` | `~/.profile` |
| 子进程依赖 | **零** | **零** | **零** |

---

## 安全

- **纯本地运行** — 不联网，不上传，不收集任何数据
- **最小权限** — 仅读写 `~/.claude/settings.json` 和自身配置文件
- **无子进程** — 不调用 PowerShell / VBScript / shell，纯 Node.js 文件操作
- **API 密钥** — 仅存储在本地 `model-configs.json`，导出时自动脱敏

---

## 路线图

Apex 1.0 已完成，未来可能的方向：

- [ ] Claude Code 项目级配置切换（`.claude/settings.local.json`）
- [ ] 模型配置模板市场（社区共享 DeepSeek / OpenAI / 自定义端点）
- [ ] 键盘快捷键全局切换
- [ ] Claude Code 版本兼容性自动检测

---

## 致谢

Apex 站在巨人的肩膀上：

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — 改变编程范式的 AI 工具
- [Electron](https://electronjs.org) — 让 Web 技术触达桌面
- [DeepSeek](https://deepseek.com) — 开放的 AI 基础设施
- 每一位追求效率、拒绝冗余的开发者

---

## 许可

MIT License © 2026 [Apex Contributors](https://github.com/wuzhigang-ai/CC-Apex/graphs/contributors)

---

<div align="center">

**Apex — 让切换回归直觉**

*多模型备用留存，一键切换 Claude Code*

</div>
