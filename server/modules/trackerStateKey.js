function parseTrackerStateKeyParts(stateKey) {
  const parts = String(stateKey || "").split(":");
  if (parts.length < 4) {
    return null;
  }

  return parts;
}

export function extractTargetKeyFromTrackerStateKey(stateKey) {
  const parts = parseTrackerStateKeyParts(stateKey);
  if (!parts) {
    return null;
  }

  const targetType = String(parts[1] || "").trim();
  const segmentA = Number(parts[2]);
  const segmentB = Number(parts[3]);
  const segmentC = Number(parts[4]);

  if ((targetType === "movie" || targetType === "series") && Number.isFinite(segmentA)) {
    return `${targetType}:${segmentA}`;
  }

  if (targetType === "season" && Number.isFinite(segmentA) && Number.isFinite(segmentB)) {
    return `${targetType}:${segmentA}:${segmentB}`;
  }

  if (
    targetType === "episode" &&
    Number.isFinite(segmentA) &&
    Number.isFinite(segmentB) &&
    Number.isFinite(segmentC)
  ) {
    return `${targetType}:${segmentA}:${segmentB}:${segmentC}`;
  }

  return null;
}

export function extractUserKeyFromTrackerStateKey(stateKey) {
  const parts = parseTrackerStateKeyParts(stateKey);
  if (!parts) {
    return "";
  }

  return String(parts[0] || "").trim();
}