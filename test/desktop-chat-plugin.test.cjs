"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

function readJson(relative) {
  return JSON.parse(readFileSync(path.join(root, relative), "utf8"));
}

function loadClientPlugin() {
  const source = readFileSync(path.join(root, "desktop-chat", "lib", "client.js"), "utf8");
  let plugin = null;
  const React = {
    Fragment: Symbol("Fragment"),
    createElement: (type, props, ...children) => ({
      type,
      props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children },
    }),
    useCallback: (callback) => callback,
    useEffect: () => {},
    useMemo: (factory) => factory(),
    useRef: (value) => ({ current: value }),
    useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  };
  const browserRequire = (request) => {
    if (request === "react") return React;
    if (request === "@deepseek-ai/dsh-client-ui-primitives") {
      return new Proxy({}, { get: () => () => null });
    }
    return require(request);
  };
  const window = {
    __ModuleLoader__: {
      load: (definition) => {
        plugin = definition.factory(browserRequire);
      },
    },
  };
  const document = {
    createElement: () => ({ dataset: {}, textContent: "" }),
    head: { appendChild: () => {} },
  };
  const localStorage = {
    getItem: () => null,
    setItem: () => {},
  };
  window.addEventListener = () => {};
  window.removeEventListener = () => {};
  window.dispatchEvent = () => {};
  const context = {
    window,
    document,
    localStorage,
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },
  };
  vm.runInNewContext(source, context, { filename: "desktop-chat-client.js" });
  return plugin;
}

function elementChildren(element) {
  const children = element?.props?.children;
  if (children === undefined || children === null) return [];
  return Array.isArray(children) ? children.flat(Infinity).filter(Boolean) : [children];
}

function findElement(element, predicate) {
  if (predicate(element)) return element;
  for (const child of elementChildren(element)) {
    if (typeof child !== "object") continue;
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return undefined;
}

test("desktop chat plugin is bundled into the v0.0.6 runtime", () => {
  assert.equal(readJson("package.json").version, "0.0.6");
  assert.equal(readJson("runtime/package.json").version, "0.0.6");
  assert.equal(readJson("desktop-chat/package.json").version, "0.0.6");
  assert.equal(readJson("desktop-updater/package.json").version, "0.0.6");
  assert.equal(
    readJson("runtime/package.json").dependencies["@deepseek-harness/desktop-chat"],
    "workspace:*",
  );
});

test("desktop chat client registers settings and sidebar surfaces", () => {
  const plugin = loadClientPlugin();
  assert.equal(plugin.inject.join(","), "slots,sessions,workspaces");

  const registrations = [];
  const ctx = {
    sessions: {},
    workspaces: {},
    slots: {
      inject: (name, register) => {
        const result = register();
        registrations.push({ name, id: result.options.id, component: result.component });
      },
      register: (options, component) => ({ options, component }),
    },
  };
  plugin.apply(ctx);

  assert.deepEqual(registrations.map(({ name, id }) => ({ name, id })), [
    { name: "settings.plugin.item", id: "desktop-chat" },
    { name: "sidebar.footer.action", id: "desktop-chat" },
  ]);
});

test("new direct chat creates and opens a session without a workspace", async () => {
  const plugin = loadClientPlugin();
  let directChat = null;
  const createCalls = [];
  const opened = [];
  const sessions = {
    list: {
      subscribe: () => () => {},
      getSnapshot: () => ({ ids: [], byId: {}, current: undefined, phase: "ready" }),
    },
    create: async (options) => {
      createCalls.push(options);
      return "direct-session-1";
    },
    open: (id) => opened.push(id),
  };
  const ctx = {
    sessions,
    workspaces: { archiveSession: async () => ({ ok: true }) },
    slots: {
      inject: (name, register) => {
        const result = register();
        if (name === "sidebar.footer.action") {
          directChat = result.component;
          assert.equal(result.options.inject().sessions, sessions);
          assert.equal(result.options.inject().workspaces, ctx.workspaces);
        }
      },
      register: (options, component) => ({ options, component }),
    },
  };
  plugin.apply(ctx);

  const rendered = directChat({ wide: true, sessions, workspaces: ctx.workspaces });
  const newChatButton = findElement(
    rendered,
    (element) => element?.type === "button" && element.props?.["aria-label"] === "新对话",
  );
  assert.ok(newChatButton);
  await newChatButton.props.onClick();

  assert.equal(createCalls.length, 1);
  assert.deepEqual(Object.keys(createCalls[0]), []);
  assert.deepEqual(opened, ["direct-session-1"]);
});

test("direct chats use the native workspace composer and stay out of workspace lists", () => {
  const source = readFileSync(path.join(root, "desktop-chat", "lib", "client.js"), "utf8");
  const conversationPatch = readFileSync(
    path.join(root, "patches", "@deepseek-ai__dsh-client-ui-conversation@0.1.0-rc.6.patch"),
    "utf8",
  );
  const workspacePatch = readFileSync(
    path.join(root, "patches", "@deepseek-ai__dsh-client-ui-workspace@0.1.0-rc.6.patch"),
    "utf8",
  );
  assert.doesNotMatch(source, /conversation\.composer/);
  assert.doesNotMatch(source, /dsh-desktop-chat-composer/);
  assert.match(conversationPatch, /const inert = sessionId === void 0;/);
  assert.match(conversationPatch, /chipTitle !== void 0 && heroWorkspaceRow/);
  assert.match(workspacePatch, /DIRECT_CHAT_SESSION_IDS_KEY/);
});

test("desktop titlebar leaves only native Windows controls", () => {
  const preload = readFileSync(path.join(root, "electron", "preload.cjs"), "utf8");
  const main = readFileSync(path.join(root, "electron", "main.cjs"), "utf8");
  assert.doesNotMatch(preload, /titlebar\.append\(icon, name\)/);
  assert.doesNotMatch(preload, /border-bottom:/);
  assert.match(preload, /backdrop-filter: blur\(18px\)/);
  assert.match(main, /color: "#00000000"/);
  assert.match(main, /session\.defaultSession\.clearCache\(\)/);
});

test("Electron installs the desktop chat plugin offline", () => {
  const main = readFileSync(path.join(root, "electron", "main.cjs"), "utf8");
  assert.match(main, /ensureDesktopChatPlugin/);
  assert.match(main, /file:plugins\/desktop-chat/);
  assert.match(main, /desktop-chat/);
});
