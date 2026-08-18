# DeepSeek Harness

[![CI](https://github.com/Icdafy/DeepSeek-Harness-Desktop/actions/workflows/ci.yml/badge.svg)](https://github.com/Icdafy/DeepSeek-Harness-Desktop/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Icdafy/DeepSeek-Harness-Desktop)](https://github.com/Icdafy/DeepSeek-Harness-Desktop/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

面向 Windows 的 DeepSeek Harness 桌面发行版。应用把上游 Web UI、本地服务、Node.js 运行时和插件管理工具封装进一个 Electron 桌面程序，安装后不需要另行配置 Node.js。

> [!IMPORTANT]
> 本项目是社区维护的桌面封装，不是 DeepSeek 官方桌面客户端。核心 Harness 来自 [deepseek-ai/DeepSeek-Harness](https://github.com/deepseek-ai/DeepSeek-Harness)，当前固定为 `@deepseek-ai/dsh@0.1.0-rc.6`。上游仍处于 developer preview，后续版本可能存在不兼容变化。

## 下载

前往 [Releases](https://github.com/Icdafy/DeepSeek-Harness-Desktop/releases/latest) 下载 Windows x64 版本：

- `DeepSeek-Harness-Setup-0.0.3-x64.exe`：标准安装器，支持选择安装目录、桌面快捷方式和卸载。
- `DeepSeek-Harness-Portable-0.0.3-x64.exe`：免安装便携版。
- `SHA256SUMS.txt`：发布文件的 SHA-256 校验值。

本版本尚未使用商业代码签名证书，Windows SmartScreen 可能显示未知发布者。请只从本仓库 Releases 下载，并核对 SHA-256。

## 使用

1. 安装或启动便携版。
2. 等待桌面窗口中的本地 Harness 服务启动。
3. 在 **Settings → Models** 中配置模型供应商和 API Key。
4. 选择工作目录后开始使用。

应用只监听 `127.0.0.1`，每次启动由操作系统分配空闲端口，不会把 Harness 服务暴露到局域网。关闭桌面窗口时，本地服务会一并退出。

## 桌面能力

- 内置 Node.js 24.14.0、DeepSeek Harness 与 pnpm，无需全局运行环境。
- NSIS 安装器与单文件便携版双产物。
- 单实例、自动选择空闲端口、服务就绪检测和进程回收。
- Electron 渲染器启用上下文隔离、沙箱并关闭 Node.js 集成。
- 外部链接交给系统浏览器，应用窗口只允许访问当前本地 Harness 来源。
- 使用 DeepSeek 官方黑色鲸鱼图标，应用名称统一为 **DeepSeek Harness**。
- 隐藏原生菜单栏，自绘标题区会跟随浅色、深色或系统主题。
- 内置 Aqua 透明 UI 插件，提供可切换的磨砂玻璃主题、动态背景和壁纸设置。
- 白底鲸鱼图标采用透明圆角过渡，更适合 Windows 桌面与任务栏显示。
- **Settings → General → 自动接收桌面更新** 可独立开启或关闭 GitHub Releases 更新，并支持手动检查。

> v0.0.1 尚未包含更新模块，因此现有 v0.0.1 用户需要手动安装 v0.0.2 一次；从 v0.0.2 开始，已开启该选项的客户端会自动接收后续正式 Release。

## 数据位置

安装版和便携版默认都把配置、会话和日志保存到用户应用数据目录：

```text
%APPDATA%\DeepSeek Harness\
├── dsh-home\
├── desktop-settings.json
└── logs\desktop.log
```

从 v0.0.1 首次升级时，若新目录尚不存在，应用会自动迁移 `%APPDATA%\DeepSeek Harness Desktop` 中的原有数据。卸载程序默认保留数据，避免误删会话和配置。

## 从源码构建

要求 Windows 10/11 x64、Node.js 24 与 pnpm 11。构建脚本会在缺少本地运行时时下载 Node.js 24.14.0，并使用官方 `SHASUMS256.txt` 校验归档。

```powershell
pnpm install --frozen-lockfile
pnpm run test
pnpm run smoke
pnpm run dist
pnpm run checksums
pnpm run verify:dist
```

构建产物位于 `dist/`。工程结构与安全边界见 [架构说明](docs/ARCHITECTURE.md)。

## 发布

推送 `v*` 标签会触发 Windows Release 工作流。流水线在干净的 GitHub Actions 环境中安装锁定依赖、运行测试、构建安装器与便携版、执行便携版冒烟测试、生成 SHA-256，并上传自动更新所需的 `latest.yml` 与 blockmap。只有正式发布的 GitHub Release 才会通知已开启自动更新的桌面客户端。

## 许可证与归属

桌面封装源码采用 [MIT License](LICENSE)。DeepSeek Harness 由 DeepSeek 开发并采用 MIT License；第三方归属见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。DeepSeek 名称与标识归其各自权利人所有。
