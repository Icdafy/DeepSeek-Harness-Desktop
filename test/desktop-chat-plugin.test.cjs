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
    createElement: (type, props, ...children) => ({
      type,
      props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children },
    }),
    useCallback: (callback) => callback,
    useEffect: () => {},
    useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  };
  const browserRequire = (request) => {
    if (request === "react") return React;
    if (request === "@deepseek-ai/dsh-client-ui-primitives") {
      return { IconNewChatOutline16: () => null };
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

test("desktop chat plugin is bundled into the v0.0.5 runtime", () => {
  assert.equal(readJson("package.json").version, "0.0.5");
  assert.equal(readJson("runtime/package.json").version, "0.0.5");
  assert.equal(readJson("desktop-chat/package.json").version, "0.0.5");
  assert.equal(readJson("desktop-updater/package.json").version, "0.0.5");
  assert.equal(
    readJson("runtime/package.json").dependencies["@deepseek-harness/desktop-chat"],
    "workspace:*",
  );
});

test("desktop chat client registers settings and sidebar surfaces", () => {
  const plugin = loadClientPlugin();
  assert.equal(plugin.inject.join(","), "slots,sessions");

  const registrations = [];
  const ctx = {
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
    { name: "conversation.composer", id: "desktop-chat" },
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
    slots: {
      inject: (name, register) => {
        const result = register();
        if (name === "sidebar.footer.action") {
          directChat = result.component;
          assert.equal(result.options.inject().sessions, sessions);
        }
      },
      register: (options, component) => ({ options, component }),
    },
  };
  plugin.apply(ctx);

  const rendered = directChat({ wide: true, sessions });
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

test("direct chat composer sends through the current session input machine", () => {
  const plugin = loadClientPlugin();
  let composer = null;
  const submitted = [];
  const drafts = [];
  const ctx = {
    slots: {
      inject: (name, register) => {
        const result = register();
        if (name === "conversation.composer") composer = result.component;
      },
      register: (options, component) => ({ options, component }),
    },
  };
  plugin.apply(ctx);

  const rendered = composer({
    useInput: (selector) => selector({ draft: "你好", phase: "plain" }),
    useSession: (selector) => selector({ running: false }),
    inputActions: {
      setDraft: (value) => drafts.push(value),
      submit: () => submitted.push(true),
    },
  });
  const input = findElement(rendered, (element) => element?.type === "textarea");
  const send = findElement(
    rendered,
    (element) => element?.type === "button" && element.props?.["aria-label"] === "发送消息",
  );
  assert.ok(input);
  assert.ok(send);
  input.props.onChange({ target: { value: "下一条" } });
  send.props.onClick();
  assert.deepEqual(drafts, ["下一条"]);
  assert.deepEqual(submitted, [true]);
});

test("Electron installs the desktop chat plugin offline", () => {
  const main = readFileSync(path.join(root, "electron", "main.cjs"), "utf8");
  assert.match(main, /ensureDesktopChatPlugin/);
  assert.match(main, /file:plugins\/desktop-chat/);
  assert.match(main, /desktop-chat/);
});
