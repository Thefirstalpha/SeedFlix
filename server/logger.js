import { isDebugMode } from "./config.js";

export function debugLog(...args) {
  if (!isDebugMode) {
    return;
  }

  console.log("[DEBUG]", ...args);
}
