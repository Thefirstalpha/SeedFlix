export function normalizeQuality(value: string | null | undefined) {
  const raw = String(value || "").toLowerCase();
  if (!raw) return "";
  if (raw.includes("2160")) return "2160p";
  if (raw.includes("1080")) return "1080p";
  if (raw.includes("720")) return "720p";
  if (raw.includes("480")) return "480p";
  if (raw.includes("bluray") || raw.includes("brrip") || raw.includes("remux")) return "bluray";
  if (raw.includes("webdl") || raw.includes("web-dl") || raw.includes("webrip")) return "webdl";
  if (raw.includes("hdtv")) return "hdtv";
  return raw;
}

export function normalizeIndexerLanguage(value: string | null | undefined) {
  const raw = String(value || "").toUpperCase();
  if (!raw) return "";
  if (raw.includes("VOSTFR")) return "VOSTFR";
  if (raw.includes("VFF")) return "VFF";
  if (raw.includes("VFQ")) return "VFQ";
  if (raw.includes("MULTI")) return "MULTI";
  if (raw === "VF" || raw.includes("FRENCH") || raw.includes("TRUEFRENCH")) return "VF";
  if (raw === "VO") return "VO";
  return raw;
}