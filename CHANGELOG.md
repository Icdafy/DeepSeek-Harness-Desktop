# Changelog

All notable changes to DeepSeek Harness are documented here.

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
