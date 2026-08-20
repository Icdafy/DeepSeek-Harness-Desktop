window.__ModuleLoader__.load({
  id: "@deepseek-harness/desktop-chat",
  factory: (require) => {
    const module = { exports: {} };
    const React = require("react");
    const {
      Button,
      IconArchiveOutline20,
      IconBranchOutline16,
      IconCloseFill14,
      IconEditOutline16,
      IconEllipsisOutline16,
      IconNewChatOutline16,
      IconSearchOutline16,
      Menu,
      Modal,
      StateDot,
      Tooltip,
    } = require("@deepseek-ai/dsh-client-ui-primitives");

    const ENABLED_KEY = "dsh.desktop-chat.enabled.v1";
    const SESSION_IDS_KEY = "dsh.desktop-chat.sessions.v1";
    const ENABLED_EVENT = "dsh-desktop-chat:enabled-changed";
    const SESSION_IDS_EVENT = "dsh-desktop-chat:sessions-changed";
    const MAX_VISIBLE_SESSIONS = 100;
    const MAX_TRACKED_SESSIONS = 500;

    const css = `
      .dsh-desktop-chat-root {
        --dsh-chat-list-edge-inset: var(--dsh-sidebar-inline-padding, 12px);
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        max-height: min(42%, 360px);
        flex: none;
        display: flex;
        flex-direction: column;
        padding-right: var(--dsh-chat-list-edge-inset);
      }
      .dsh-desktop-chat-root[data-wide="false"] {
        width: 36px;
        max-height: none;
        align-items: center;
        padding-right: 0;
      }
      .dsh-desktop-chat-header {
        box-sizing: border-box;
        height: 36px;
        flex: none;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
        margin: 2px -4px 4px 0;
        padding-left: 4px;
        overflow: hidden;
        color: var(--dsw-alias-label-tertiary, #737a82);
        border-radius: 12px;
      }
      .dsh-desktop-chat-title {
        min-width: 0;
        max-width: 45%;
        flex: none;
        margin-right: auto;
        overflow: hidden;
        font-size: 14px;
        line-height: 20px;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition: max-width .18s var(--ds-ease-in-out), opacity .12s var(--ds-ease-in-out);
      }
      .dsh-desktop-chat-root[data-search="true"] .dsh-desktop-chat-title {
        max-width: 0;
        opacity: 0;
      }
      .dsh-desktop-chat-icon-button,
      .dsh-desktop-chat-search-button,
      .dsh-desktop-chat-clear,
      .dsh-desktop-chat-row-menu {
        cursor: pointer;
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 0;
        color: var(--dsw-alias-label-secondary, #6b7280);
        background: transparent;
      }
      .dsh-desktop-chat-icon-button,
      .dsh-desktop-chat-search-button {
        width: 28px;
        height: 28px;
        border-radius: 50%;
      }
      .dsh-desktop-chat-icon-button:hover,
      .dsh-desktop-chat-search-button:hover,
      .dsh-desktop-chat-clear:hover,
      .dsh-desktop-chat-row-menu:hover {
        background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, .10));
      }
      .dsh-desktop-chat-icon-button:disabled { cursor: default; opacity: .45; }
      .dsh-desktop-chat-search-wrap {
        box-sizing: border-box;
        min-width: 0;
        width: 28px;
        height: 28px;
        flex: none;
        display: flex;
        align-items: center;
        margin-left: auto;
        overflow: hidden;
        border: 0;
        border-radius: 50%;
        transition: width .18s var(--ds-ease-in-out), border-color .18s var(--ds-ease-in-out);
      }
      .dsh-desktop-chat-root[data-search="true"] .dsh-desktop-chat-search-wrap {
        width: calc(100% - 36px);
        height: 30px;
        border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, .18));
        border-radius: 10px;
      }
      .dsh-desktop-chat-search-input {
        min-width: 0;
        width: 0;
        flex: 1;
        opacity: 0;
        pointer-events: none;
        color: var(--dsw-alias-label-primary, #171717);
        background: transparent;
        border: 0;
        outline: 0;
        font: inherit;
        font-size: 13px;
        line-height: 18px;
      }
      .dsh-desktop-chat-root[data-search="true"] .dsh-desktop-chat-search-input {
        width: auto;
        opacity: 1;
        pointer-events: auto;
      }
      .dsh-desktop-chat-search-input::placeholder { color: var(--dsw-alias-label-tertiary, #737a82); }
      .dsh-desktop-chat-clear {
        width: 24px;
        height: 24px;
        border-radius: 50%;
      }
      .dsh-desktop-chat-list-area {
        min-height: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
        margin-left: -4px;
        margin-right: calc(-1 * var(--dsh-chat-list-edge-inset));
        padding-left: 4px;
        overflow: visible;
        position: relative;
      }
      .dsh-desktop-chat-list {
        min-height: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin: 0 2px 0 -4px;
        padding: 0 calc(var(--dsh-chat-list-edge-inset) - 10px) 16px 4px;
        overflow-y: auto;
        scrollbar-gutter: stable;
      }
      .dsh-desktop-chat-fade {
        pointer-events: none;
        position: absolute;
        right: var(--dsh-chat-list-edge-inset);
        bottom: 0;
        left: 0;
        height: 24px;
        background: linear-gradient(to bottom, transparent, var(--dsw-specific-sidebar-fill));
      }
      .dsh-desktop-chat-item {
        cursor: pointer;
        box-sizing: border-box;
        min-width: 0;
        height: 32px;
        flex: none;
        display: flex;
        align-items: center;
        gap: 0;
        padding: 0 8px;
        border: 0;
        border-radius: 8px;
        color: var(--dsw-alias-label-primary, #171717);
        background: transparent;
        font: inherit;
        text-align: left;
        animation: dsh-desktop-chat-row-in .15s var(--ds-ease-in-out);
      }
      @keyframes dsh-desktop-chat-row-in { from { opacity: 0; } }
      .dsh-desktop-chat-item:hover,
      .dsh-desktop-chat-item[data-current="true"],
      .dsh-desktop-chat-item[data-menu-open="true"] {
        background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, .10));
      }
      .dsh-desktop-chat-item-status {
        width: 16px;
        height: 20px;
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .dsh-desktop-chat-item-title {
        min-width: 0;
        flex: 1;
        margin: 0 6px 0 4px;
        overflow: hidden;
        font-size: 14px;
        line-height: 20px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dsh-desktop-chat-item-time {
        flex: none;
        color: var(--dsw-alias-label-tertiary, #737a82);
        font-size: 12px;
        line-height: 20px;
      }
      .dsh-desktop-chat-row-actions { display: none; flex: none; }
      .dsh-desktop-chat-item:hover .dsh-desktop-chat-row-actions,
      .dsh-desktop-chat-item[data-menu-open="true"] .dsh-desktop-chat-row-actions { display: inline-flex; }
      .dsh-desktop-chat-item:hover .dsh-desktop-chat-item-time,
      .dsh-desktop-chat-item[data-menu-open="true"] .dsh-desktop-chat-item-time { display: none; }
      .dsh-desktop-chat-row-menu {
        width: 16px;
        height: 16px;
        border-radius: 4px;
        color: var(--dsw-alias-label-tertiary, #737a82);
      }
      .dsh-desktop-chat-empty,
      .dsh-desktop-chat-error {
        margin: 0;
        padding: 16px 12px;
        color: var(--dsw-alias-label-tertiary, #737a82);
        font-size: 13px;
        line-height: 20px;
      }
      .dsh-desktop-chat-error { color: var(--dsw-alias-state-error-primary, #d14343); }
      .dsh-desktop-chat-rename-input {
        box-sizing: border-box;
        width: 100%;
        height: 44px;
        padding: 7px 14px;
        border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, .18));
        border-radius: 22px;
        outline: 0;
        color: var(--dsw-alias-label-primary, #171717);
        background: transparent;
        font: inherit;
        font-size: 14px;
        line-height: 22px;
      }
      .dsh-desktop-chat-card {
        box-sizing: border-box;
        min-height: 78px;
        display: flex;
        align-items: center;
        gap: 18px;
        padding: 14px 4px;
        border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, .16));
        color: var(--dsw-alias-label-primary, #171717);
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
      .dsh-desktop-chat-rail-action {
        cursor: pointer;
        width: 36px;
        height: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 0;
        border-radius: 10px;
        color: var(--dsw-alias-label-primary, #171717);
        background: transparent;
      }
      .dsh-desktop-chat-rail-action:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, .10)); }
      @media (prefers-reduced-motion: reduce) {
        .dsh-desktop-chat-item,
        .dsh-desktop-chat-title,
        .dsh-desktop-chat-search-wrap { animation: none; transition: none; }
      }
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

    function titleOf(summary) {
      return summary?.displayTitle || summary?.title || "新对话";
    }

    function timeOf(updatedAt) {
      if (!Number.isFinite(updatedAt)) return "";
      const diff = Math.max(0, Date.now() - updatedAt);
      if (diff < 60_000) return "刚刚";
      if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟`;
      if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时`;
      if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}天`;
      return `${Math.floor(diff / 2_592_000_000)}个月`;
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

    function DirectChatRow({ id, summary, current, sessions, onRename, onFork, onArchive }) {
      const [menuOpen, setMenuOpen] = React.useState(false);
      const title = titleOf(summary);
      const menuItems = [
        { id: "rename", label: "重命名", icon: React.createElement(IconEditOutline16) },
        { id: "fork", label: "分叉对话", icon: React.createElement(IconBranchOutline16) },
        { id: "archive", label: "归档对话", icon: React.createElement(IconArchiveOutline20, { size: 16 }) },
      ];
      return React.createElement("div", {
        className: "dsh-desktop-chat-item",
        role: "treeitem",
        title,
        "aria-selected": current === id,
        "data-current": current === id ? "true" : "false",
        "data-menu-open": menuOpen ? "true" : "false",
        onClick: () => sessions.open(id),
      },
        React.createElement("span", {
          className: "dsh-desktop-chat-item-status",
          "aria-hidden": "true",
        }, summary?.running ? React.createElement(StateDot, { state: "ongoing" }) : null),
        React.createElement("span", { className: "dsh-desktop-chat-item-title" }, title),
        summary?.blank ? null : React.createElement("span", {
          className: "dsh-desktop-chat-item-time",
        }, timeOf(summary?.updatedAt)),
        summary?.blank ? null : React.createElement("span", {
          className: "dsh-desktop-chat-row-actions",
        }, React.createElement(Menu, {
          open: menuOpen,
          portal: true,
          closeOnPointerLeave: true,
          items: menuItems,
          onClose: () => setMenuOpen(false),
          onSelect: (action) => {
            setMenuOpen(false);
            if (action === "rename") onRename(id, summary?.title || title);
            if (action === "fork") onFork(id);
            if (action === "archive") onArchive(id);
          },
          anchor: React.createElement("button", {
            type: "button",
            className: "dsh-desktop-chat-row-menu",
            "aria-label": `${title}的操作`,
            onClick: (event) => {
              event.stopPropagation();
              setMenuOpen((value) => !value);
            },
          }, React.createElement(IconEllipsisOutline16)),
        })),
      );
    }

    function DirectChatModule({ wide, expandSidebar, sessions, workspaces }) {
      const [enabled] = useEnabled();
      const [savedIds, saveSessionIds] = useSavedSessionIds();
      const snapshot = useSessionList(sessions.list);
      const [creating, setCreating] = React.useState(false);
      const [query, setQuery] = React.useState("");
      const [searchExpanded, setSearchExpanded] = React.useState(false);
      const [error, setError] = React.useState("");
      const [renameTarget, setRenameTarget] = React.useState(null);
      const [renameDraft, setRenameDraft] = React.useState("");
      const [renaming, setRenaming] = React.useState(false);
      const searchInput = React.useRef(null);

      if (!enabled) return null;

      const normalizedQuery = query.trim().toLowerCase();
      const chats = savedIds
        .slice(0, MAX_VISIBLE_SESSIONS)
        .map((id) => ({ id, summary: snapshot.byId[id] }))
        .filter(({ summary }) => summary !== undefined)
        .filter(({ summary }) => normalizedQuery === "" || titleOf(summary).toLowerCase().includes(normalizedQuery));

      const saveFront = (id) => saveSessionIds([id, ...savedIds.filter((saved) => saved !== id)]);
      const removeSaved = (id) => saveSessionIds(savedIds.filter((saved) => saved !== id));

      const createChat = async () => {
        if (creating) return;
        setCreating(true);
        setError("");
        try {
          const sessionId = await sessions.create({});
          saveFront(sessionId);
          sessions.open(sessionId);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
          setCreating(false);
        }
      };

      const forkChat = async (sessionId) => {
        setError("");
        try {
          const childId = await sessions.fork({ sessionId, increaseTitle: true });
          saveFront(childId);
          sessions.open(childId);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      };

      const archiveChat = async (sessionId) => {
        setError("");
        try {
          const result = await workspaces.archiveSession(sessionId);
          if (result?.ok === false) throw new Error(result.error?.message || "归档失败");
          removeSaved(sessionId);
          if (snapshot.current === sessionId) sessions.clear();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      };

      const confirmRename = async () => {
        const title = renameDraft.trim();
        if (renameTarget === null || title === "" || renaming) return;
        setRenaming(true);
        setError("");
        try {
          const session = sessions.binding(renameTarget)?.session;
          if (session === undefined) throw new Error("对话暂不可用");
          const result = await session.rename(title);
          if (!result.ok) throw new Error(result.error.message);
          setRenameTarget(null);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
          setRenaming(false);
        }
      };

      if (!wide) {
        return React.createElement("section", {
          className: "dsh-desktop-chat-root",
          "data-wide": "false",
          "aria-label": "对话区",
        },
          React.createElement(Tooltip, {
            label: "搜索对话",
            delayMs: 500,
          }, React.createElement("button", {
            type: "button",
            className: "dsh-desktop-chat-rail-action",
            "aria-label": "搜索对话",
            onClick: () => {
              setSearchExpanded(true);
              expandSidebar?.();
            },
          }, React.createElement(IconSearchOutline16, { size: 18 }))),
          React.createElement(Tooltip, {
            label: "新对话",
            delayMs: 500,
          }, React.createElement("button", {
            type: "button",
            className: "dsh-desktop-chat-rail-action",
            "aria-label": "新对话",
            disabled: creating,
            onClick: createChat,
          }, React.createElement(IconNewChatOutline16, { size: 18 }))),
        );
      }

      return React.createElement("section", {
        className: "dsh-desktop-chat-root",
        "data-wide": "true",
        "data-search": searchExpanded ? "true" : "false",
        "aria-label": "对话区",
      },
        React.createElement("div", { className: "dsh-desktop-chat-header" },
          React.createElement("span", { className: "dsh-desktop-chat-title" }, "对话"),
          React.createElement("div", {
            className: "dsh-desktop-chat-search-wrap",
            onClick: () => {
              setSearchExpanded(true);
              searchInput.current?.focus();
            },
          },
            React.createElement("button", {
              type: "button",
              className: "dsh-desktop-chat-search-button",
              "aria-label": "搜索对话",
              "aria-expanded": searchExpanded,
              onClick: () => setSearchExpanded(true),
            }, React.createElement(IconSearchOutline16, { size: searchExpanded ? 11 : 14 })),
            React.createElement("input", {
              ref: searchInput,
              className: "dsh-desktop-chat-search-input",
              type: "text",
              placeholder: "搜索对话...",
              maxLength: 200,
              value: query,
              tabIndex: searchExpanded ? 0 : -1,
              onChange: (event) => setQuery(event.target.value),
              onKeyDown: (event) => {
                if (event.key !== "Escape") return;
                setQuery("");
                setSearchExpanded(false);
              },
            }),
            searchExpanded ? React.createElement("button", {
              type: "button",
              className: "dsh-desktop-chat-clear",
              "aria-label": "清除搜索",
              onClick: (event) => {
                event.stopPropagation();
                setQuery("");
                setSearchExpanded(false);
              },
            }, React.createElement(IconCloseFill14)) : null,
          ),
          React.createElement(Tooltip, {
            label: "新对话",
            side: "bottom",
            delayMs: 500,
          }, React.createElement("button", {
            type: "button",
            className: "dsh-desktop-chat-icon-button",
            title: "新对话",
            "aria-label": "新对话",
            disabled: creating,
            onClick: createChat,
          }, React.createElement(IconNewChatOutline16, { size: 16 }))),
        ),
        React.createElement("div", { className: "dsh-desktop-chat-list-area" },
          React.createElement("div", {
            className: "dsh-desktop-chat-list",
            role: "tree",
            "aria-label": "对话列表",
          },
            chats.map(({ id, summary }) => React.createElement(DirectChatRow, {
              key: id,
              id,
              summary,
              current: snapshot.current,
              sessions,
              onRename: (sessionId, title) => {
                setRenameTarget(sessionId);
                setRenameDraft(title);
              },
              onFork: forkChat,
              onArchive: archiveChat,
            })),
            chats.length === 0 && !error ? React.createElement("p", {
              className: "dsh-desktop-chat-empty",
            }, normalizedQuery === "" ? "直接与模型对话，无需选择工作区" : "没有匹配的对话") : null,
            error ? React.createElement("p", {
              className: "dsh-desktop-chat-error",
              role: "status",
            }, error) : null,
          ),
          React.createElement("span", { className: "dsh-desktop-chat-fade" }),
        ),
        React.createElement(Modal, {
          open: renameTarget !== null,
          title: "重命名对话",
          closeLabel: "关闭",
          onClose: () => {
            if (!renaming) setRenameTarget(null);
          },
          footer: React.createElement(React.Fragment, null,
            React.createElement(Button, {
              variant: "outline",
              disabled: renaming,
              onClick: () => setRenameTarget(null),
            }, "取消"),
            React.createElement(Button, {
              variant: "primary",
              disabled: renaming || renameDraft.trim() === "",
              onClick: confirmRename,
            }, renaming ? "保存中..." : "保存"),
          ),
        }, React.createElement("input", {
          className: "dsh-desktop-chat-rename-input",
          value: renameDraft,
          autoFocus: true,
          disabled: renaming,
          onChange: (event) => setRenameDraft(event.target.value),
          onKeyDown: (event) => {
            if (event.key === "Enter" && !event.nativeEvent?.isComposing) confirmRename();
          },
        })),
      );
    }

    function ChatPluginSetting() {
      const [enabled, setEnabled] = useEnabled();
      return React.createElement("li", { className: "dsh-desktop-chat-card" },
        React.createElement("div", { className: "dsh-desktop-chat-card-copy" },
          React.createElement("p", { className: "dsh-desktop-chat-card-title" }, "直接对话"),
          React.createElement("p", { className: "dsh-desktop-chat-card-description" },
            "在侧边栏显示独立对话区；输入框、模型、模式、权限与指令能力和工作区会话完全一致。",
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

    const inject = ["slots", "sessions", "workspaces"];
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
        inject: () => ({ sessions: ctx.sessions, workspaces: ctx.workspaces }),
      }, DirectChatModule));
    }

    module.exports.apply = apply;
    module.exports.inject = inject;
    return module.exports;
  },
});
