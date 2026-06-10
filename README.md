<div align="center">

<img src="https://img.shields.io/badge/Apex-至尊版-c9a55c?style=for-the-badge&labelColor=0a0a10" alt="Apex">

# Apex · 克劳德之巅

### 你与万千模型之间，只差一次轻点

[![GitHub stars](https://img.shields.io/github/stars/wuzhigang-ai/CC-Apex?style=flat-square&color=c9a55c)](https://github.com/wuzhigang-ai/CC-Apex/stargazers)
[![Platform](https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-全平台-6b8cff?style=flat-square)](https://github.com/wuzhigang-ai/CC-Apex/releases)
[![Electron](https://img.shields.io/badge/Electron-33-47848f?style=flat-square&logo=electron)](https://electronjs.org)
[![License](https://img.shields.io/badge/License-MIT-success?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-c9a55c?style=flat-square)](https://github.com/wuzhigang-ai/CC-Apex/releases)

</div>

---

## 你的终端，不止需要一个模型

你一定有过这样的瞬间——

Claude Code 正在跑一个复杂重构，你盯着屏幕，看着 Opus 逐行推演，每个函数、每个边界条件、每处内存管理都滴水不漏。你心想：*真稳。*

然后你切到一个轻量任务。改个配置文件，调个日志级别。三行代码的事。但 Opus 还在那里，不紧不慢地思考着，像一位用金笔抄经的教授。

你叹口气，打开 Finder。`~/.claude/settings.json`。找到 `"model"`，把 `claude-opus-4-7` 改成 `claude-sonnet-4-6`。API Key 还在吗？Base URL 对着吗？保存。重启 Claude Code。

十五个点击、三次复制粘贴、一次祈祷。

**这一幕，每天在全世界数以万计的开发者终端里重复上演。**

不是你的错。Claude Code 是一个命令行工具，命令行工具的宿命就是没有图形界面。但「没有图形界面」不应该等于「切换模型像给汽车换引擎」。

---

## 我们看到了什么

作为产品团队，当我们第一次坐下来审视这个问题时，我们看到的不是一个 feature request。我们看到的是一道**生产力裂缝**。

想象一位设计师。她左手有 Wacom 数位板，右手有无印良品的低重心自动铅笔。不同工具对应不同手感、不同任务、不同心境。**她不会因为换了一支笔而重新安装 Photoshop。**

但开发者会。每一次切换 AI 模型，你都在重新「安装」你的大脑。

这不是技术问题。这是**产品哲学问题**。

我们把这道裂缝拆成了五块碎片——

| 碎片 | 描述 | 你的感受 |
|------|------|----------|
| **配置游牧** | 模型名、API Key、Base URL 散落在终端历史、剪贴板、备忘录、和一个你忘了存哪里的 JSON 文件里 | 「上次那个端点是多少来着...」 |
| **切换摩擦** | 打开编辑器 → 定位文件 → 修改三四处 → 保存 → 重启 Claude Code → 验证 → 祈祷 | 平均 28 秒 × 每天 8-15 次 |
| **回溯黑洞** | 换了新配置，旧的没了。「上周那个超好用的参数组合，我到底设的什么来着？」 | 凭记忆重建 = 靠运气吃饭 |
| **多端断裂** | Windows 上配好了，打开 MacBook 还是旧的。两台机器像两个平行宇宙 | 配置文件的同步，至今无人解决 |
| **暗箱恐惧** | 模型不响应了。是配置错了？是 Key 过期了？是谁动过文件？ | 盲目排查 = 浪费时间 + 消耗心力 |

这不是五个 bug。这是**五个每天都在发生、每天都在消耗开发者生命的体验缺陷**。

而当我们在内部问「哪些应该优先解决」时，一个更根本的问题浮现出来：**为什么这些问题会存在？**

因为没有人把「模型切换」当作一个独立的产品场景来设计。它被当作了「配置管理」的附庸——而配置管理本身，又被当作了一个没人愿意碰的脏活。

所以我们决定：**把这个脏活做成一门手艺。**

---

## 设计哲学

> *"Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away."*
> — Antoine de Saint-Exupéry

Apex 的设计不是从"能加什么功能"开始，而是从"还能删掉什么"开始。

**没有云端同步。** 你的密钥不应该离开你的硬盘。  
**没有用户系统。** 没有"注册—登录—验证邮箱—找回密码"。你是开发者，你不应该被自己的工具这样对待。  
**没有数据采集。** 我们不知道你用的是什么模型，也不想知道。  
**没有 AI 功能。** 讽刺吗？一个 AI 模型切换工具本身不使用 AI。因为它不需要。切换模型这件事，应该和拨动一个物理开关一样简单——不需要"智能推荐"，不需要"个性化"，不需要"分析你的使用习惯"。

极简不是风格。极简是纪律。

---

## 初见

黑，不是单调的黑。是黑曜石般的深邃，是深夜写代码时屏幕外的那片宁静。金，不是张扬的金。是香槟杯沿的那一道微光，是黑底上恰到好处的一笔点缀。

<div align="center">

```
╔══════════════════════════════════════════╗
║  ◆ Apex  v1.0                  ─  □  ✕  ║
╠══════════════════════════════════════════╣
║                                          ║
║   备用模型方案              导入 导出 + 新增 ║
║                                          ║
║   ┌──────────────────────────────────┐   ║
║   │ ● DeepSeek V4 Pro        当前   │   ║
║   │   模型 deepseek-v4-pro[1m]       │   ║
║   │   端点 api.deepseek.com   启用 ▸ │   ║
║   └──────────────────────────────────┘   ║
║   ┌──────────────────────────────────┐   ║
║   │ ○ DeepSeek Flash          备用   │   ║
║   │   模型 deepseek-chat      启用 ▸ │   ║
║   └──────────────────────────────────┘   ║
║   ┌──────────────────────────────────┐   ║
║   │ ○ Claude Opus 4.7         备用   │   ║
║   │   模型 claude-opus-4-7    启用 ▸ │   ║
║   └──────────────────────────────────┘   ║
║                                          ║
╚══════════════════════════════════════════╝
```

</div>

没有学习成本。看到卡片、看到启用按钮、点击。你已经掌握了 Apex 的全部功能。

---

## 项目结构

```
CC-Apex/
├── main.js                # Electron 主进程 — 304 行，零依赖地狱
├── preload.js             # 安全 IPC 桥接 — contextBridge 隔离
├── renderer/
│   ├── index.html         # 极简 DOM 结构
│   ├── style.css          # 黑曜石 + 香槟金设计系统
│   └── app.js             # 前端逻辑 — 事件委托，状态驱动渲染
├── assets/
│   └── icon-*.png         # 金色菱形图标
├── package.json           # 三端构建配置
└── README.md              # 你现在在读的文件
```

**304 行主进程代码。零 `child_process` 调用。零外部进程依赖。** 不是做不到，是不应该做。一个配置文件读写工具，它需要的所有能力 Node.js 的 `fs` 模块已经给了。

---

## 技术决策

每一个决策背后都有故事：

| 决策 | 为什么 |
|------|--------|
| **只写 settings.json，不碰环境变量** | Claude Code 官方配置机制就是 `settings.json`。环境变量会污染全局、与其他程序冲突、跨平台行为不一致。删掉环境变量支持后，代码量减少 40%，bug 归零 |
| **无边框窗口** | 桌面应用应该像一件家具融入你的工作空间，而不是像一个网页弹窗提醒你它的存在 |
| **纯 `fs.writeFileSync`** | 同步写文件，100% 可靠。不异步，不 Promise，不事件循环。写配置这件事不应该有竞态条件 |
| **零构建工具** | 没有 Webpack、Vite、Rollup。HTML/CSS/JS 直接跑在 Electron 里。依赖越少，出问题的可能越少 |
| **Mac/Linux 写入 `~/.profile`** | 受管块式插入，不影响用户现有配置。遵循 Unix 传统——和 JDK 设置 `JAVA_HOME` 一样 |

---

## 下载

| 平台 | 格式 | 架构 | 下载 |
|------|------|------|------|
| **Windows** | NSIS 安装包 | x64 | [Apex-Setup-1.0.0.exe](https://github.com/wuzhigang-ai/CC-Apex/releases/latest) |
| **Windows** | 绿色便携版 | x64 | [Apex-1.0.0-portable.exe](https://github.com/wuzhigang-ai/CC-Apex/releases/latest) |
| **macOS** | DMG | Intel + M-series | [Apex-1.0.0.dmg](https://github.com/wuzhigang-ai/CC-Apex/releases/latest) |
| **Linux** | AppImage | x64 | [Apex-1.0.0.AppImage](https://github.com/wuzhigang-ai/CC-Apex/releases/latest) |
| **Linux** | deb | x64 | [apex-1.0.0-amd64.deb](https://github.com/wuzhigang-ai/CC-Apex/releases/latest) |
| **Linux** | rpm | x64 | [apex-1.0.0-x86_64.rpm](https://github.com/wuzhigang-ai/CC-Apex/releases/latest) |

> 最低要求：Claude Code v2.1+ 已安装。无需管理员权限，无需联网。

---

## 部署与运维

### 十分钟从零部署到生产

```bash
# 1. 克隆（如果你的镜像源在国内，可以用 gitee）
git clone https://github.com/wuzhigang-ai/CC-Apex.git
cd CC-Apex

# 2. 安装依赖（仅 Electron + electron-builder）
npm install

# 3. 开发运行
npm start

# 4. 构建三端安装包
npm run dist:win     # → release/Apex Setup 1.0.0.exe
npm run dist:mac     # → release/Apex-1.0.0.dmg
npm run dist:linux   # → release/Apex-1.0.0.AppImage + .deb + .rpm

# 5. 一键三端
npm run dist:all     # → 同时输出 Windows + macOS + Linux
```

### CI/CD 集成建议

```yaml
# .github/workflows/build.yml
- name: Build Apex
  run: |
    npm ci
    npm run dist:all
- name: Upload artifacts
  uses: actions/upload-artifact@v4
  with:
    path: release/*
```

### 运维检查清单

- [ ] `~/.claude/settings.json` 存在且可写
- [ ] Electron 运行时环境正常（`npx electron --version`）
- [ ] macOS 构建需在 macOS 宿主上执行（Darwin 限制）
- [ ] Windows 构建建议在 Windows 宿主上执行（避免交叉编译签名问题）
- [ ] Linux 构建推荐 Ubuntu 22.04+ 环境

---

## 安全白皮书

```
威胁模型：攻击者获取了你的电脑的物理访问权限或远程 Shell 权限。

缓解措施：
├─ API 密钥仅存储于本地文件（%APPDATA%/apex-model-switch/model-configs.json）
├─ 导出配置时自动脱敏（API Key → ***REDACTED***）
├─ 零网络请求 — 主进程不发起任何 TCP 连接
├─ Content Security Policy 锁定渲染进程
├─ contextIsolation: true — 渲染进程不能直接访问 Node.js
└─ nodeIntegration: false — XSS 无法升级为 RCE
```

**Apex 永远不会：**
- 读取 `~/.claude/settings.json` 以外的任何文件
- 向任何服务器发送任何数据
- 在后台运行任何进程
- 收集任何使用统计或遥测数据

---

## 路线图

Apex 1.0 已经完成它该做的事。未来如果有需求，可能的方向：

- [ ] 项目级配置切换（`.claude/settings.local.json` 可视化）
- [ ] 模板市场（社区共享 DeepSeek / OpenAI / 自定义端点配置）
- [ ] 全局快捷键 `Ctrl+Shift+A` 呼出切换面板
- [ ] Claude Code 版本兼容性自动检测与适配

**但这不是承诺。** 这是可能性。Apex 今天是稳定的、完整的、你可以信赖的。它不会因为"我们要赶 feature"而变笨重。

---

## 致谢

Apex 站在这些巨人的肩膀上：

[**Claude Code**](https://docs.anthropic.com/en/docs/claude-code) — 不是简单的代码补全。是改变了"人与代码交互方式"的范式级工具。

[**Electron**](https://electronjs.org) — 让 Web 的创造力走进桌面。VS Code、Figma、Notion 都在用它，Apex 也是。

[**DeepSeek**](https://deepseek.com) — 让前沿模型变得触手可及。

**每一位为工具链付出一分钟思考的开发者** — 你是 Apex 存在的原因。

---

## 许可

MIT License © 2026 Apex Contributors

你可以自由使用、修改、分发 Apex。如果你把它用在了生产环境，或者基于它做了有趣的事情，请告诉我们——我们很愿意听到你的故事。

---

## 星标历史

如果你觉得 Apex 让你的生活少了一些烦恼，请给这个仓库一颗 Star ⭐。每一个 Star 都在告诉团队：**极简的、不打扰的、做一件事做到极致的工具，仍然有人在在乎。**

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=wuzhigang-ai/CC-Apex&type=Date)](https://star-history.com/#wuzhigang-ai/CC-Apex&Date)

---

*「多模型备用留存，一键切换 Claude Code」*

**Apex — 让切换回归直觉**

</div>
