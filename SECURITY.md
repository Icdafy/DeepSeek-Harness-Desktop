# Security policy

## Supported versions

Only the latest published release receives security fixes.

## Reporting a vulnerability

Please do not open a public issue for an unpatched vulnerability. Use GitHub's private vulnerability reporting feature for this repository when available, or contact the repository owner privately through their GitHub profile.

Include the affected version, reproduction steps, impact, and any proposed mitigation. Reports concerning the upstream Harness itself should also be coordinated with [deepseek-ai/DeepSeek-Harness](https://github.com/deepseek-ai/DeepSeek-Harness).

## Local security boundary

The desktop application binds the Harness service to `127.0.0.1` on an operating-system-assigned port. Its renderer has Node.js integration disabled, context isolation and sandboxing enabled, permission requests denied, and navigation restricted to the active local Harness origin. External HTTP(S) links open in the system browser.
