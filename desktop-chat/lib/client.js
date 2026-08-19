window.__ModuleLoader__.load({
  id: "@deepseek-harness/desktop-chat",
  factory: (require) => {
    const module = { exports: {} };
    const React = require("react");
    const { IconNewChatOutline16 } = require("@deepseek-ai/dsh-client-ui-primitives");

    const ENABLED_KEY = "dsh.desktop-chat.enabled.v1";
    const SESSION_IDS_KEY = "dsh.desktop-chat.sessions.v1";
    const ENABLED_EVENT = "dsh-desktop-chat:enabled-changed";
    const SESSION_IDS_EVENT = "dsh-desktop-chat:sessions-changed";
    const MAX_VISIBLE_SESSIONS = 20;
    const MAX_TRACKED_SESSIONS = 500;

    const css = `
      .dsh-desktop-chat-root {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        flex: none;
        display: flex;
        flex-direction: column;
        margin: 6px 0 8px;
        padding-right: var(--dsh-sidebar-inline-padding, 12px);
      }
      .dsh-desktop-chat-root[data-wide="false"] {
        width: 36px;
        align-items: center;
        margin: 0 0 8px;
        padding-right: 0;
      }
      .dsh-desktop-chat-header {
        box-sizing: border-box;
        height: 36px;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 6px;
        margin-right: -4px;
        margin-bottom: 4px;
        padding: 0 4px;
      }
      .dsh-desktop-chat-title {
        min-width: 0;
        flex: none;
        max-width: 45%;
        overflow: hidden;
        color: var(--dsw-alias-label-tertiary, #737a82);
        font-size: 14px;
        font-weight: 400;
        line-height: 20px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dsh-desktop-chat-new {
        cursor: pointer;
        width: 28px;
        height: 28px;
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 0;
        border-radius: 50%;
        color: var(--dsw-alias-label-secondary, #6b7280);
        background: transparent;
      }
      .dsh-desktop-chat-root[data-wide="false"] .dsh-desktop-chat-new {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        color: var(--dsw-alias-label-primary, #171717);
      }
      .dsh-desktop-chat-new:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, .10)); }
      .dsh-desktop-chat-new:disabled { cursor: default; opacity: .5; }
      .dsh-desktop-chat-list {
        min-height: 0;
        max-height: 192px;
        margin: 0 -4px 0 -4px;
        padding: 0 4px 4px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        overflow-y: auto;
        scrollbar-gutter: stable;
      }
      .dsh-desktop-chat-list[hidden] { display: none; }
      .dsh-desktop-chat-item {
        cursor: pointer;
        min-width: 0;
        height: 32px;
        flex: none;
        display: flex;
        align-items: center;
        gap: 0;
        overflow: hidden;
        padding: 0 8px;
        border: 0;
        border-radius: 8px;
        color: var(--dsw-alias-label-primary, #171717);
        background: transparent;
        font: inherit;
        font-size: 14px;
        line-height: 20px;
        text-align: left;
      }
      .dsh-desktop-chat-item:hover {
        background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, .10));
      }
      .dsh-desktop-chat-item[aria-current="true"] {
        background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, .10));
      }
      .dsh-desktop-chat-item-icon {
        width: 16px;
        height: 20px;
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--dsw-alias-label-tertiary, #737a82);
      }
      .dsh-desktop-chat-item-title {
        min-width: 0;
        flex: 1;
        margin-left: 4px;
        overflow: hidden;
        font-size: 14px;
        line-height: 20px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dsh-desktop-chat-empty,
      .dsh-desktop-chat-error {
        margin: 0;
        padding: 16px 12px;
        color: var(--dsw-alias-label-tertiary, #737a82);
        font-size: 13px;
        line-height: 20px;
      }
      .dsh-desktop-chat-error { color: #d14343; }
      .dsh-desktop-chat-card {
        box-sizing: border-box;
        min-height: 78px;
        padding: 14px 4px;
        border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, .16));
        color: var(--dsw-alias-label-primary, #171717);
        display: flex;
        align-items: center;
        gap: 18px;
      }
      .dsh-desktop-chat-card-copy { min-width: 0; flex: 1; }
      .dsh-desktop-chat-card-title { margin: 0; font-size: 14px; font-weight: 500; line-height: 22px; }
      .dsh-desktop-chat-card-description,
      .dsh-desktop-chat-card-status {
        margin: 2px 0 0;
        color: var(--dsw-alias-label-secondary, #6b7280);
        font-size: 12px;
        line-height: 18px;
      }
      .dsh-desktop-chat-switch {
        box-sizing: border-box;
        cursor: pointer;
        width: 42px;
        height: 24px;
        flex: none;
        display: inline-block;
        padding: 2px;
        border: 0;
        border-radius: 999px;
        background: var(--dsw-alias-fill-quaternary, #c7c9cf);
        transition: background-color .16s ease;
      }
      .dsh-desktop-chat-switch[aria-checked="true"] { background: #4d6bfe; }
      .dsh-desktop-chat-switch-thumb {
        display: block;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, .2);
        transform: translateX(0);
        transition: transform .16s ease;
      }
      .dsh-desktop-chat-switch[aria-checked="true"] .dsh-desktop-chat-switch-thumb { transform: translateX(18px); }
      .dsh-desktop-chat-composer {
        box-sizing: border-box;
        width: min(calc(var(--dsh-chat-content-width, 748px) + 32px), calc(100% - 32px));
        align-self: center;
        display: flex;
        align-items: flex-end;
        gap: 10px;
        margin: 0 auto 24px;
        padding: 12px 12px 12px 16px;
        border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, .18));
        border-radius: 18px;
        background: var(--dsw-alias-bg-base, #fff);
        box-shadow: 0 8px 24px rgba(0, 0, 0, .08);
      }
      .dsh-desktop-chat-input {
        box-sizing: border-box;
        min-width: 0;
        min-height: 48px;
        max-height: 220px;
        flex: 1;
        resize: none;
        overflow-y: auto;
        padding: 2px 0;
        border: 0;
        outline: 0;
        color: var(--dsw-alias-label-primary, #171717);
        background: transparent;
        font: inherit;
        font-size: 14px;
        line-height: 22px;
      }
      .dsh-desktop-chat-input::placeholder { color: var(--dsw-alias-label-caption, #8b9199); }
      .dsh-desktop-chat-send {
        cursor: pointer;
        width: 34px;
        height: 34px;
        flex: none;
        display: inline-grid;
        place-items: center;
        padding: 0;
        border: 0;
        border-radius: 50%;
        color: #fff;
        background: var(--dsw-alias-state-business-primary, #4d6bfe);
        font-size: 20px;
        line-height: 1;
      }
      .dsh-desktop-chat-send:disabled { cursor: default; opacity: .42; }
    `;

    const style = document.createElement("style");
    style.dataset.plugin = "@deepseek-harness/desktop-chat";
    style.textContent = css;
    document.head.appendChild(style);

    function readEnabled() {
      try {
        return localStorage.getItem(ENABLED_KEY) !== "false";
      } catch {
        return true;
      }
    }

    function writeEnabled(value) {
      try {
        localStorage.setItem(ENABLED_KEY, String(value));
      } catch {
        // The in-memory toggle remains usable when browser storage is denied.
      }
      window.dispatchEvent(new CustomEvent(ENABLED_EVENT, { detail: value }));
    }

    function readSessionIds() {
      try {
        const value = JSON.parse(localStorage.getItem(SESSION_IDS_KEY) ?? "[]");
        if (!Array.isArray(value)) return [];
        return value.filter((id) => typeof id === "string" && id).slice(0, MAX_TRACKED_SESSIONS);
      } catch {
        return [];
      }
    }

    function writeSessionIds(ids) {
      const saved = [...new Set(ids.filter((id) => typeof id === "string" && id))]
        .slice(0, MAX_TRACKED_SESSIONS);
      try {
        localStorage.setItem(SESSION_IDS_KEY, JSON.stringify(saved));
      } catch {
        // A failed write only limits recall across reloads.
      }
      window.dispatchEvent(new CustomEvent(SESSION_IDS_EVENT, { detail: saved }));
      return saved;
    }

    function subscribe(name, callback) {
      const listener = () => callback();
      window.addEventListener(name, listener);
      window.addEventListener("storage", listener);
      return () => {
        window.removeEventListener(name, listener);
        window.removeEventListener("storage", listener);
      };
    }

    function useEnabled() {
      const [enabled, setEnabled] = React.useState(readEnabled);
      React.useEffect(() => subscribe(ENABLED_EVENT, () => setEnabled(readEnabled())), []);
      return [enabled, setEnabled];
    }

    function useSavedSessionIds() {
      const [ids, setIds] = React.useState(readSessionIds);
      React.useEffect(() => subscribe(SESSION_IDS_EVENT, () => setIds(readSessionIds())), []);
      const save = React.useCallback((next) => setIds(writeSessionIds(next)), []);
      return [ids, save];
    }

    function useSessionList(store) {
      return React.useSyncExternalStore(
        (listener) => store.subscribe(listener),
        () => store.getSnapshot(),
      );
    }

    function newChatIcon(size) {
      return React.createElement(IconNewChatOutline16, { size });
    }

    function Switch({ checked, label, onChange }) {
      return React.createElement("button", {
        type: "button",
        role: "switch",
        "aria-label": label,
        "aria-checked": checked ? "true" : "false",
        className: "dsh-desktop-chat-switch",
        onClick: () => onChange(!checked),
      }, React.createElement("span", { className: "dsh-desktop-chat-switch-thumb" }));
    }

    function DirectChatModule({ wide, sessions }) {
      const [enabled] = useEnabled();
      const [savedIds, saveSessionIds] = useSavedSessionIds();
      const [creating, setCreating] = React.useState(false);
      const [error, setError] = React.useState("");
      const snapshot = useSessionList(sessions.list);

      if (!enabled) return null;

      const chats = savedIds
        .slice(0, MAX_VISIBLE_SESSIONS)
        .map((id) => ({ id, summary: snapshot.byId[id] }))
        .filter(({ summary }) => summary !== undefined);

      const createChat = async () => {
        if (creating) return;
        setCreating(true);
        setError("");
        try {
          const sessionId = await sessions.create({});
          saveSessionIds([sessionId, ...savedIds]);
          sessions.open(sessionId);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
          setCreating(false);
        }
      };

      if (!wide) {
        return React.createElement("section", {
          className: "dsh-desktop-chat-root",
          "data-wide": "false",
          "aria-label": "对话区",
        }, React.createElement("button", {
          type: "button",
          className: "dsh-desktop-chat-new",
          title: "新对话",
          "aria-label": "新对话",
          disabled: creating,
          onClick: createChat,
        }, newChatIcon(18)));
      }

      return React.createElement("section", {
        className: "dsh-desktop-chat-root",
        "data-wide": "true",
        "aria-label": "对话区",
      },
        React.createElement("div", { className: "dsh-desktop-chat-header" },
          React.createElement("span", { className: "dsh-desktop-chat-title" }, "对话区"),
          React.createElement("button", {
            type: "button",
            className: "dsh-desktop-chat-new",
            title: "新对话",
            "aria-label": "新对话",
            disabled: creating,
            onClick: createChat,
          }, newChatIcon(14)),
        ),
        React.createElement("div", {
          className: "dsh-desktop-chat-list",
          role: "list",
          hidden: chats.length === 0,
        },
          chats.map(({ id, summary }) => React.createElement("button", {
            key: id,
            type: "button",
            className: "dsh-desktop-chat-item",
            role: "listitem",
            title: summary.title || "新对话",
            "aria-current": snapshot.current === id ? "true" : "false",
            onClick: () => sessions.open(id),
          },
            React.createElement("span", {
              className: "dsh-desktop-chat-item-icon",
              "aria-hidden": "true",
            }, newChatIcon(16)),
            React.createElement("span", { className: "dsh-desktop-chat-item-title" },
              summary.title || "新对话",
            ),
          )),
        ),
        chats.length === 0 && !error
          ? React.createElement("p", { className: "dsh-desktop-chat-empty" }, "直接与模型对话，无需选择工作区")
          : null,
        error ? React.createElement("p", {
          className: "dsh-desktop-chat-error",
          role: "status",
        }, error) : null,
      );
    }

    function ChatPluginSetting() {
      const [enabled, setEnabled] = useEnabled();
      return React.createElement("li", { className: "dsh-desktop-chat-card" },
        React.createElement("div", { className: "dsh-desktop-chat-card-copy" },
          React.createElement("p", { className: "dsh-desktop-chat-card-title" }, "直接对话"),
          React.createElement("p", { className: "dsh-desktop-chat-card-description" },
            "在侧边栏工作区下方显示对话区，可新建无工作区会话并直接与当前模型交流。",
          ),
          React.createElement("p", { className: "dsh-desktop-chat-card-status" },
            enabled ? "已开启" : "已关闭",
          ),
        ),
        React.createElement(Switch, {
          checked: enabled,
          label: "启用直接对话插件",
          onChange: (value) => {
            writeEnabled(value);
            setEnabled(value);
          },
        }),
      );
    }

    function selectDirectChatComposer({ session }) {
      if (!readEnabled() || session === undefined) return null;
      return readSessionIds().includes(session.sessionId) ? session.sessionId : null;
    }

    function DirectChatComposer({ useInput, inputActions, useSession }) {
      const input = useInput((state) => state);
      const running = useSession((state) => state.running) ?? false;
      const draft = input?.draft ?? "";
      const ready = input !== undefined && inputActions !== undefined && input.phase === "plain";
      const canSend = ready && draft.trim() !== "";
      const submit = () => {
        if (canSend) inputActions.submit();
      };

      return React.createElement("div", {
        className: "dsh-desktop-chat-composer",
        "data-direct-chat-composer": "",
      },
        React.createElement("textarea", {
          className: "dsh-desktop-chat-input",
          value: draft,
          disabled: !ready,
          rows: 2,
          placeholder: running ? "输入消息以排队发送" : "给模型发消息",
          "aria-label": "给模型发消息",
          onChange: (event) => inputActions?.setDraft(event.target.value),
          onKeyDown: (event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent?.isComposing) return;
            event.preventDefault();
            submit();
          },
        }),
        React.createElement("button", {
          type: "button",
          className: "dsh-desktop-chat-send",
          disabled: !canSend,
          title: running ? "排队发送" : "发送消息",
          "aria-label": running ? "排队发送" : "发送消息",
          onClick: submit,
        }, "↑"),
      );
    }

    const inject = ["slots", "sessions"];
    function apply(ctx) {
      ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
        name: "settings.plugin.item",
        id: "desktop-chat",
        order: 30,
      }, ChatPluginSetting));

      ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
        name: "sidebar.footer.action",
        id: "desktop-chat",
        order: 10,
        inject: () => ({ sessions: ctx.sessions }),
      }, DirectChatModule));

      ctx.slots.inject("conversation.composer", () => ctx.slots.register({
        name: "conversation.composer",
        id: "desktop-chat",
        priority: 20,
        select: selectDirectChatComposer,
      }, DirectChatComposer));
    }

    module.exports.apply = apply;
    module.exports.inject = inject;
    return module.exports;
  },
});
