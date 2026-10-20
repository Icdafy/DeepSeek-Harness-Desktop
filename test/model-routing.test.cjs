"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const runtimeModules = process.env.DSH_MODEL_TEST_RUNTIME || path.join(__dirname, "../node_modules");
const providerModule = import(pathToFileURL(path.join(runtimeModules, "@deepseek-ai/dsh-llm-deepseek/lib/index.js")).href);
const flashIds = ["deepseek-flash", "deepseek-v4-flash", "deepseek-v4-flash-vision-exp"];

function successfulStream() {
  const events = [
    { type: "message_start", message: { id: "msg_test", type: "message", role: "assistant", model: "deepseek-flash", content: [], usage: { input_tokens: 1, output_tokens: 0 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "OK" } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } },
    { type: "message_stop" },
  ];
  return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""), {
    headers: { "content-type": "text/event-stream" },
  });
}

test("bundled Flash catalog uses the current API name and identifies the 1017 model", async () => {
  const { resolveAdapterOptions } = await providerModule;
  const options = resolveAdapterOptions({});
  const flash = options.models.find(model => model.id === "deepseek-flash");
  assert.equal(flash.name, "DeepSeek-V4.1-Flash-1017");
  assert.deepEqual(flash.inputModalities, ["text", "image"]);
  assert.equal(flash.systemPromptUpdate, "in-history");
  assert.equal(flash.toolUpdate, "addition-only");
  assert.equal(options.baseURL, "https://api.deepseek.com/anthropic");
  assert.deepEqual(options.models.map(model => model.id), ["deepseek-flash", "deepseek-v4-pro"]);
});

test("legacy catalogs converge on one Flash entry and retain other configured models", async () => {
  const { resolveAdapterOptions } = await providerModule;
  for (const models of [
    [{ id: flashIds[1] }, { id: flashIds[2] }],
    [{ id: flashIds[2] }, { id: flashIds[1] }],
    [{ id: flashIds[1] }, { id: flashIds[0] }, { id: flashIds[2] }],
  ]) {
    const configured = [...models, { id: "deepseek-v4-pro" }, { id: "custom-model" }];
    const before = structuredClone(configured);
    const options = resolveAdapterOptions({ models: configured });
    assert.deepEqual(options.models.map(model => model.id), ["deepseek-flash", "deepseek-v4-pro", "custom-model"]);
    assert.deepEqual(configured, before);
  }
  assert.throws(() => resolveAdapterOptions({ models: [{ id: "custom" }, { id: "custom" }] }), /duplicate catalog model/);
});

test("legacy selections retain Harness route identity and resolve with current Flash capabilities", async t => {
  const { DeepSeekAdapter, resolveAdapterOptions } = await providerModule;
  const { Context } = await import(pathToFileURL(path.join(runtimeModules, "@deepseek-ai/cordis/lib/index.js")).href);
  const { LlmRuntime } = await import(pathToFileURL(path.join(runtimeModules, "@deepseek-ai/dsh-llm/lib/index.js")).href);
  const adapter = new DeepSeekAdapter({ options: () => resolveAdapterOptions({}), resolveFiles: () => ({}) });
  const llm = new LlmRuntime(new Context());
  t.after(llm.registerAdapter(["deepseek-official"], adapter));
  for (const model of flashIds) {
    const resolved = await llm.resolveModelInfo("deepseek-official", model);
    // Harness requires metadata to preserve the selected route ID. The adapter
    // resolves its capabilities and wire request through the canonical Flash ID.
    assert.equal(resolved.id, model);
    assert.equal(resolved.name, "DeepSeek-V4.1-Flash-1017");
    assert.deepEqual(resolved.inputModalities, ["text", "image"]);
    assert.deepEqual(adapter.imageRequestTarget("deepseek-official", model, { width: 640, height: 480 }),
      adapter.imageRequestTarget("deepseek-official", "deepseek-flash", { width: 640, height: 480 }));
  }
});

test("actual streaming request bodies use deepseek-flash for both current and retired Flash names", async t => {
  const { DeepSeekAdapter, resolveAdapterOptions } = await providerModule;
  const { Context } = await import(pathToFileURL(path.join(runtimeModules, "@deepseek-ai/cordis/lib/index.js")).href);
  const { LlmRuntime } = await import(pathToFileURL(path.join(runtimeModules, "@deepseek-ai/dsh-llm/lib/index.js")).href);
  const requests = [];
  const admitted = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url, headers: options.headers, body: JSON.parse(options.body) });
    return successfulStream();
  });
  const connection = resolveAdapterOptions({});
  const adapter = new DeepSeekAdapter({
    options: () => connection,
    resolveFiles: () => ({}),
    resolveAuth: async () => ({ headers: { "x-api-key": "test-only" } }),
    resolveUserId: () => "model-routing-test",
    prepareExtensions: async () => ({ fields: {}, accept: async () => {} }),
    admit: (_connection, model) => admitted.push(model),
  });
  const llm = new LlmRuntime(new Context());
  t.after(llm.registerAdapter(["deepseek-official"], adapter));
  for (const dispatch of ["direct", "prepared", "runtime"]) {
    for (const model of [...flashIds, "deepseek-v4-pro", "custom-model"]) {
      const expected = flashIds.includes(model) ? "deepseek-flash" : model;
      const options = {
        provider: "deepseek-official", model, reasoningEffort: "high", maxTokens: 128,
        messages: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
      };
      const call = dispatch === "runtime"
        ? await llm.prepareCall({ provider: options.provider, model, reasoningEffort: "high", maxTokens: 128 })
        : dispatch === "prepared" ? await adapter.prepareCall(options.provider, model) : adapter;
      if (dispatch === "prepared") assert.equal(call.model.id, model);
      if (dispatch === "runtime") assert.equal(call.config.model, model);
      const chunks = [];
      for await (const chunk of call.stream(options)) chunks.push(chunk);
      const request = requests.at(-1);
      assert.equal(request.body.model, expected);
      assert.equal(admitted.at(-1), expected);
      assert.equal(new URL(request.url).origin, "https://api.deepseek.com");
      assert.match(new URL(request.url).pathname, /^\/anthropic\/(?:v1\/)?messages$/);
      assert.equal(request.headers["x-api-key"], "test-only");
      assert.equal(request.body.stream, true);
      assert.equal(request.body.max_tokens, 128);
      assert.deepEqual(request.body.thinking, { type: "enabled" });
      assert.deepEqual(request.body.output_config, { effort: "high" });
      assert.ok(chunks.some(chunk => chunk.type === "text-delta" && chunk.text === "OK"));
      assert.ok(chunks.some(chunk => chunk.type === "finish" && chunk.reason.kind === "stop"));
      assert.equal(options.model, model);
    }
  }
  assert.equal(requests.length, 15);
});
