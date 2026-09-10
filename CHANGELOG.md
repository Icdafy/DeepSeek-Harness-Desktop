# Changelog

All notable changes to DeepSeek Harness are documented here.

## [0.0.9] - 2026-09-10

### Added

- Always-visible per-chat ellipsis menus, including blank conversations, with rename and permanent local deletion.
- Permanent deletion removes every persisted log generation and derived transcript cache, clears workspace references, and reconnects the UI; active tasks block deletion until they finish.
- Isolated Electron UI smoke coverage for creation, durable rename, deletion, sibling preservation, and reload.

### Changed

- Updated the complete bundled Harness runtime from `0.1.0-rc.6` to the latest official release candidate `0.1.5-rc.1`, including file uploads, multi-tab previews, DeepSeek-V41-Flash, V3 session migration, and upstream Windows/reconnection fixes.
- Renamed the visible sidebar heading to “对话区”.
- Rebased desktop UI patches and adapted Aqua to the upstream client runtime split. Desktop plugin switches now live in Settings → Plugins → 桌面插件.
- Support the upstream authenticated launch URL and suppress automatic browser opening; refresh offline plugins when their bundled contents change.

### Upgrade notes

- Upstream migrates supported historical sessions into V3 logs while retaining original generations. New V3 history cannot be read by older Harness versions.
- Permanent deletion does not remove independent forked conversations, project files, or globally shared attachment blobs.

## [0.0.8] - 2026-08-20

### Changed

- Switched update discovery to the direct GitHub Releases latest-download endpoint, avoiding the multi-request Atom feed lookup.
- Added automatic retries for transient update-check and installer-download failures.
- Replaced raw networking errors with actionable guidance for GitHub reachability, system proxy, and firewall issues.

## [0.0.7] - 2026-08-20

### Changed

- Moved the direct-chat section up so it sits immediately below the workspace browser instead of being pushed to the bottom of the sidebar.

## [0.0.6] - 2026-08-20

### Changed

- Removed the titlebar logo and product name, leaving only the native minimize, maximize, and close controls.
- Replaced the hard titlebar divider with a theme-aware translucent blur and soft visual transition into the application surface.
- Rebuilt the direct-chat sidebar section to match the workspace browser, including search, activity state, rename, fork, archive, and collapsed-rail actions.
- Direct chats now use the native Harness workspace conversation composer, including mode selection, the add/command entry, Full access, model selection, attachments, queues, and all other registered composer slots.
- Direct-chat sessions are kept out of workspace group and workspace search results.
- Clear the Chromium module cache at startup and service restart so patched desktop UI modules take effect immediately after an upgrade.

## [0.0.5] - 2026-08-19

### Added

- Added a bundled direct-chat plugin with a toggle in Settings → Plugins.
- Added a Chat section below the workspace area in the sidebar, including a New Chat action that creates a workspace-less session and opens the normal model conversation view.
- Persist recent direct-chat sessions locally so they remain available after restarting the app.

## [0.0.4] - 2026-08-18

### Fixed

- Keep a stable per-user loopback origin so Aqua appearance choices, wallpaper data, and other browser-local UI preferences survive application restarts.
- Restore the previous window size, position, and maximized state while rejecting geometry that is no longer visible on a connected display.
- Preserve unrelated desktop settings when the automatic-update preference is changed.

## [0.0.3] - 2026-08-18

### Added

- Bundled `dsh-client-ui-aqua@1.3.1` and install it offline into the Web profile so the Aqua transparent UI is available out of the box.

### Changed

- Reworked the white application-icon tile with transparent rounded corners instead of a square background.

## [0.0.2] - 2026-08-17

### Added

- Added a user-scoped desktop updater plugin under Settings → General, enabled by default with an independent on/off switch and manual check action.
- Added GitHub Releases update metadata and blockmap publication for per-user background delivery.

### Changed

- Renamed the displayed application from DeepSeek Harness Desktop to DeepSeek Harness.
- Replaced the application artwork with DeepSeek's official black whale on a white background.
- Removed the native File, Edit, View, and Help menu row.
- Matched the Windows title bar and window controls to the active application theme.
- Migrates existing v0.0.1 user data to the renamed application directory on first launch.

## [0.0.1] - 2026-08-17

### Added

- First Windows x64 desktop distribution of DeepSeek Harness.
- Electron window backed by a private loopback Harness service on a random free port.
- Bundled Node.js 24.14.0, `@deepseek-ai/dsh@0.1.0-rc.6`, and pnpm 11.22.0.
- NSIS installer and portable executable.
- Single-instance handling, startup readiness checks, local logging, service restart, and process cleanup.
- Reproducible CI and tag-based GitHub Release workflow with SHA-256 checksums.

[0.0.1]: https://github.com/Icdafy/DeepSeek-Harness-Desktop/releases/tag/v0.0.1
[0.0.2]: https://github.com/Icdafy/DeepSeek-Harness-Desktop/releases/tag/v0.0.2
[0.0.3]: https://github.com/Icdafy/DeepSeek-Harness-Desktop/releases/tag/v0.0.3
[0.0.4]: https://github.com/Icdafy/DeepSeek-Harness-Desktop/releases/tag/v0.0.4
[0.0.5]: https://github.com/Icdafy/DeepSeek-Harness-Desktop/releases/tag/v0.0.5
[0.0.6]: https://github.com/Icdafy/DeepSeek-Harness-Desktop/releases/tag/v0.0.6
[0.0.7]: https://github.com/Icdafy/DeepSeek-Harness-Desktop/releases/tag/v0.0.7
[0.0.8]: https://github.com/Icdafy/DeepSeek-Harness-Desktop/releases/tag/v0.0.8
[0.0.9]: https://github.com/Icdafy/DeepSeek-Harness-Desktop/releases/tag/v0.0.9
