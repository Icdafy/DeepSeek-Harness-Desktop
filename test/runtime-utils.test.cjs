"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  extractHarnessUrl,
  isAllowedAppNavigation,
  isSafeExternalUrl,
  prependPath,
} = require("../electron/runtime-utils.cjs");

test("extractHarnessUrl accepts only the loopback startup line", () => {
  assert.equal(
    extractHarnessUrl("dsh web: http://127.0.0.1:50109"),
    "http://127.0.0.1:50109",
  );
  assert.equal(extractHarnessUrl("dsh web: http://0.0.0.0:50109"), null);
  assert.equal(extractHarnessUrl("unrelated output"), null);
});

test("navigation is restricted to the active Harness origin", () => {
  const origin = "http://127.0.0.1:50109";
  assert.equal(isAllowedAppNavigation(`${origin}/settings`, origin), true);
  assert.equal(isAllowedAppNavigation("http://127.0.0.1:50110", origin), false);
  assert.equal(isAllowedAppNavigation("https://example.com", origin), false);
  assert.equal(isAllowedAppNavigation("file:///C:/Windows/win.ini", origin), false);
  assert.equal(isAllowedAppNavigation("file:///loading.html", null), true);
});

test("external links accept only HTTP and HTTPS", () => {
  assert.equal(isSafeExternalUrl("https://github.com/deepseek-ai/DeepSeek-Harness"), true);
  assert.equal(isSafeExternalUrl("http://example.com"), true);
  assert.equal(isSafeExternalUrl("file:///C:/Windows/System32/cmd.exe"), false);
  assert.equal(isSafeExternalUrl("javascript:alert(1)"), false);
});

test("runtime paths are prepended without dropping the existing PATH", () => {
  assert.equal(prependPath(["A", "B"], "C", ";"), "A;B;C");
  assert.equal(prependPath(["A", ""], "", ";"), "A");
});
