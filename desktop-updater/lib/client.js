window.__ModuleLoader__.load({
  id: "@deepseek-harness/desktop-updater",
  factory: (require) => {
    const module = { exports: {} };
    const React = require("react");

    const css = `
      .dsh-desktop-update-row {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 18px;
        min-height: 78px;
        padding: 14px 4px;
        border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, .16));
        color: var(--dsw-alias-label-primary, #171717);
      }
      .dsh-desktop-update-copy { flex: 1; min-width: 0; }
      .dsh-desktop-update-title { margin: 0; font-size: 14px; font-weight: 500; line-height: 22px; }
      .dsh-desktop-update-description,
      .dsh-desktop-update-status {
        margin: 2px 0 0;
        color: var(--dsw-alias-label-secondary, #6b7280);
        font-size: 12px;
        line-height: 18px;
      }
      .dsh-desktop-update-status[data-error="true"] { color: #d14343; }
      .dsh-desktop-update-actions { display: flex; align-items: center; gap: 10px; }
      .dsh-desktop-update-check {
        cursor: pointer;
        min-width: 74px;
        height: 30px;
        padding: 0 12px;
        border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, .22));
        border-radius: 9px;
        color: inherit;
        background: var(--dsw-alias-bg-layer-2, #fff);
        font: inherit;
        font-size: 12px;
      }
      .dsh-desktop-update-check:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, .10)); }
      .dsh-desktop-update-check:disabled { cursor: default; opacity: .45; }
      .dsh-desktop-update-switch {
        box-sizing: border-box;
        cursor: pointer;
        width: 42px;
        height: 24px;
        padding: 2px;
        border: 0;
        border-radius: 999px;
        background: var(--dsw-alias-fill-quaternary, #c7c9cf);
        transition: background-color .16s ease;
      }
      .dsh-desktop-update-switch[aria-checked="true"] { background: #4d6bfe; }
      .dsh-desktop-update-switch-thumb {
        display: block;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, .2);
        transform: translateX(0);
        transition: transform .16s ease;
      }
      .dsh-desktop-update-switch[aria-checked="true"] .dsh-desktop-update-switch-thumb { transform: translateX(18px); }
      .dsh-desktop-update-switch:disabled { cursor: wait; opacity: .6; }
    `;

    const style = document.createElement("style");
    style.dataset.plugin = "@deepseek-harness/desktop-updater";
    style.textContent = css;
    document.head.appendChild(style);

    function statusText(state) {
      switch (state.status) {
        case "disabled": return "已关闭自动更新";
        case "checking": return "正在检查 GitHub Releases…";
        case "available": return `发现 v${state.availableVersion || "新版本"}，准备下载`;
        case "downloading": return `正在下载 v${state.availableVersion || "新版本"}${Number.isFinite(state.percent) ? ` · ${Math.round(state.percent)}%` : ""}`;
        case "downloaded": return `v${state.availableVersion || "新版本"} 已下载，退出应用时自动安装`;
        case "up-to-date": return `当前 v${state.currentVersion} 已是最新版本`;
        case "development": return "开发模式不连接更新服务器；打包版本会自动检查";
        case "error": return state.message || "更新检查失败，请稍后重试";
        default: return "已开启；启动后及每 6 小时自动检查一次";
      }
    }

    function UpdatePreference() {
      const bridge = globalThis.deepseekHarnessDesktop?.updates;
      const [state, setState] = React.useState({
        enabled: true,
        currentVersion: "0.0.6",
        status: bridge ? "idle" : "development",
      });
      const [saving, setSaving] = React.useState(false);

      React.useEffect(() => {
        if (!bridge) return undefined;
        let mounted = true;
        bridge.getState().then((value) => {
          if (mounted) setState(value);
        });
        const unsubscribe = bridge.onState((value) => {
          if (mounted) setState(value);
        });
        return () => {
          mounted = false;
          if (typeof unsubscribe === "function") unsubscribe();
        };
      }, []);

      const toggle = async () => {
        if (!bridge || saving) return;
        setSaving(true);
        try {
          setState(await bridge.setEnabled(!state.enabled));
        } finally {
          setSaving(false);
        }
      };

      const checking = state.status === "checking" || state.status === "downloading";
      return React.createElement("div", { className: "dsh-desktop-update-row" },
        React.createElement("div", { className: "dsh-desktop-update-copy" },
          React.createElement("p", { className: "dsh-desktop-update-title" }, "自动接收桌面更新"),
          React.createElement("p", { className: "dsh-desktop-update-description" },
            "从 GitHub Releases 自动检查和下载新版本；下载完成后在退出应用时安装。",
          ),
          React.createElement("p", {
            className: "dsh-desktop-update-status",
            "data-error": state.status === "error" ? "true" : "false",
          }, statusText(state)),
        ),
        React.createElement("div", { className: "dsh-desktop-update-actions" },
          React.createElement("button", {
            type: "button",
            className: "dsh-desktop-update-check",
            disabled: !bridge || !state.enabled || checking,
            onClick: () => bridge?.checkNow(),
          }, state.status === "downloaded" ? "已下载" : "检查更新"),
          React.createElement("button", {
            type: "button",
            role: "switch",
            "aria-label": "自动接收桌面更新",
            "aria-checked": state.enabled ? "true" : "false",
            className: "dsh-desktop-update-switch",
            disabled: !bridge || saving,
            onClick: toggle,
          }, React.createElement("span", { className: "dsh-desktop-update-switch-thumb" })),
        ),
      );
    }

    const inject = ["slots"];
    function apply(ctx) {
      ctx.slots.inject("settings.general.item", () => ctx.slots.register({
        name: "settings.general.item",
        id: "desktop-updates",
        order: 80,
      }, UpdatePreference));
    }

    module.exports.apply = apply;
    module.exports.inject = inject;
    return module.exports;
  },
});
