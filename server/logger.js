import { isDebugMode } from "./config.js";

function nowIso() {
  return new Date().toISOString();
}

export function infoLog(...args) {
  console.log(`[INFO] ${nowIso()}`, ...args);
}

export function errorLog(...args) {
  console.error(`[ERROR] ${nowIso()}`, ...args);
}

export function requestLog(...args) {
  console.log(`[HTTP] ${nowIso()}`, ...args);
}

export function debugLog(...args) {
  if (!isDebugMode) {
    return;
  }

  console.log(`[DEBUG] ${nowIso()}`, ...args);
}
