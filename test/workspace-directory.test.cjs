"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function controller() {
  const file = path.join(__dirname, "../node_modules/@deepseek-ai/dsh-api-session-controller/lib/types/agent.js");
  const { ApiSessionAgentController } = await import(pathToFileURL(file).href);
  const calls = [];
  const ctx = {
    typert: { lookups: { configure() {} }, contexts: { configureHost() {} } },
    sessions: { get: () => undefined },
    agents: { get: () => undefined, create: async (options) => { calls.push(options); return { agent: { session: { id: options.sessionId, header: options.meta } } }; } },
    agentDefaultModel: { currentSelection: () => ({ provider: "test", model: "test" }) },
    get: () => undefined,
  };
  return { controller: new ApiSessionAgentController(ctx), calls };
}

test("session creation never resurrects a removed workspace, including repeated startup attempts", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-workspace-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const missing = path.join(root, "Desktop", "人形机器人研究");
  const fixture = await controller();
  for (let index = 0; index < 3; index++) {
    await assert.rejects(fixture.controller.ensureSession(`startup-${index}`, missing, false), /工作目录不存在或不可访问/);
    assert.equal(fs.existsSync(path.join(root, "Desktop")), false);
  }
  assert.equal(fixture.calls.length, 0);
});

test("existing workspaces can create sessions and non-directory paths are rejected", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-workspace-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = await controller();
  const agent = await fixture.controller.ensureSession("valid-session", root, false);
  assert.equal(agent.session.id, "valid-session");
  assert.equal(fixture.calls[0].meta.cwd, root);
  const file = path.join(root, "report.md");
  fs.writeFileSync(file, "keep");
  await assert.rejects(fixture.controller.ensureSession("invalid-session", file, false), /工作目录不存在或不可访问/);
  assert.equal(fs.readFileSync(file, "utf8"), "keep");
  assert.equal(fixture.calls.length, 1);
});
