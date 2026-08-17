"use strict";

function extractHarnessUrl(line) {
  const match = String(line).match(/dsh web:\s+(http:\/\/127\.0\.0\.1:\d+)/i);
  return match?.[1] ?? null;
}

function isAllowedAppNavigation(targetUrl, harnessUrl) {
  try {
    if (String(targetUrl).startsWith("file:")) return !harnessUrl;
    if (!harnessUrl) return false;
    return new URL(targetUrl).origin === new URL(harnessUrl).origin;
  } catch {
    return false;
  }
}

function isSafeExternalUrl(targetUrl) {
  try {
    const protocol = new URL(targetUrl).protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function prependPath(entries, existingPath, delimiter = ";") {
  return [...entries, existingPath].filter(Boolean).join(delimiter);
}

module.exports = {
  extractHarnessUrl,
  isAllowedAppNavigation,
  isSafeExternalUrl,
  prependPath,
};
