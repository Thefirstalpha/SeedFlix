import { requireAuth } from "./auth.js";
import { debugLog } from "../logger.js";

const torznabTimeoutMs = 8000;

function redactTorznabUrl(url) {
  const clone = new URL(url.toString());
  if (clone.searchParams.has("apikey")) {
    clone.searchParams.set("apikey", "***");
  }
  return clone.toString();
}

function truncateForLogs(value, maxLength = 1000) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function bytesToHuman(size) {
  if (!Number.isFinite(size) || size <= 0) {
    return null;
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  let value = size;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[index]}`;
}

function extractQualityFromTitle(title) {
  const normalized = String(title || "").toLowerCase();

  const resolution =
    (normalized.match(/\b(2160p|1080p|720p|480p)\b/i)?.[1] || null);

  const source =
    (normalized.match(/\b(uhd|bluray|brrip|web[- .]?dl|webrip|hdtv|dvdrip|remux)\b/i)?.[1] || null);

  if (resolution && source) {
    return `${resolution.toUpperCase()} ${source.toUpperCase().replace(/[- .]/g, "")}`;
  }
  if (resolution) {
    return resolution.toUpperCase();
  }
  if (source) {
    return source.toUpperCase().replace(/[- .]/g, "");
  }

  return null;
}

function buildTorznabSearchUrl(rawUrl, apiKey, query = "", limit = 1) {
  let url;

  try {
    url = new URL(String(rawUrl || "").trim());
  } catch {
    throw new Error("URL Torznab invalide");
  }

  url.searchParams.set("t", "search");
  url.searchParams.set("limit", String(limit));
  if (query) {
    url.searchParams.set("q", query);
  }
  if (apiKey) {
    url.searchParams.set("apikey", apiKey);
  }

  return url;
}

function parseTorznabResponse(xmlText) {
  const errorMatch = xmlText.match(
    /<error[^>]*code="([^"]+)"[^>]*description="([^"]+)"/i
  );
  if (errorMatch) {
    return {
      ok: false,
      code: errorMatch[1],
      message: errorMatch[2],
    };
  }

  const hasRss = /<rss[\s>]/i.test(xmlText);
  const titleMatch = xmlText.match(/<title>([^<]+)<\/title>/i);

  if (!hasRss) {
    return {
      ok: false,
      message: "La réponse reçue n'est pas une réponse Torznab de recherche valide",
    };
  }

  return {
    ok: true,
    title: titleMatch?.[1]?.trim() || null,
  };
}

function parseTorznabItems(xmlText, maxItems = 5) {
  const items = [];
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  const itemBlocks = xmlText.match(itemRegex) || [];

  for (const block of itemBlocks.slice(0, maxItems)) {
    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
    const guidMatch = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
    const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const sizeMatch = block.match(/torznab:attr[^>]*name="size"[^>]*value="([^"]+)"/i);
    const seedersMatch = block.match(/torznab:attr[^>]*name="seeders"[^>]*value="([^"]+)"/i);
    const leechersMatch = block.match(/torznab:attr[^>]*name="peers"[^>]*value="([^"]+)"/i);
    const categoryMatches = [...block.matchAll(/<category[^>]*>([^<]+)<\/category>/gi)];
    const attrMatches = [...block.matchAll(/torznab:attr[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi)];

    const title = decodeXmlEntities(titleMatch?.[1]?.trim() || "");
    if (!title) {
      continue;
    }

    const attributes = attrMatches.reduce((acc, match) => {
      const key = String(match[1] || "").trim();
      if (!key) {
        return acc;
      }

      acc[key] = decodeXmlEntities(match[2] || "");
      return acc;
    }, {});

    const qualityFromAttributes =
      attributes.resolution ||
      attributes.quality ||
      attributes.video ||
      null;
    const quality = qualityFromAttributes || extractQualityFromTitle(title);
    const language =
      attributes.language ||
      attributes.lang ||
      null;

    const size = Number(sizeMatch?.[1] || 0) || null;

    items.push({
      title,
      link: decodeXmlEntities(linkMatch?.[1]?.trim() || ""),
      guid: decodeXmlEntities(guidMatch?.[1]?.trim() || ""),
      pubDate: decodeXmlEntities(pubDateMatch?.[1]?.trim() || ""),
      size,
      sizeHuman: size ? bytesToHuman(size) : null,
      seeders: Number(seedersMatch?.[1] || 0) || null,
      leechers: Number(leechersMatch?.[1] || 0) || null,
      quality,
      language,
      categories: categoryMatches
        .map((match) => decodeXmlEntities(match[1] || ""))
        .filter(Boolean),
      attributes,
    });
  }

  return items.sort((a, b) => {
    const sizeA = Number(a.size || 0);
    const sizeB = Number(b.size || 0);
    if (sizeA !== sizeB) {
      return sizeB - sizeA;
    }

    const seedersA = Number(a.seeders || 0);
    const seedersB = Number(b.seeders || 0);
    return seedersB - seedersA;
  });
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), torznabTimeoutMs);

  try {
    return await fetch(url, {
      headers: {
        Accept: "application/xml, text/xml;q=0.9, */*;q=0.1",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function resolveIndexerSettings(auth, body) {
  const savedIndexer = auth.user.settings?.placeholders?.indexer || {};

  const hasBodyUrl =
    body && typeof body === "object" && Object.hasOwn(body, "url");
  const hasBodyToken =
    body && typeof body === "object" && Object.hasOwn(body, "token");

  const urlSource = hasBodyUrl ? body.url : savedIndexer.url;
  const tokenSource = hasBodyToken ? body.token : savedIndexer.token;

  const url = String(urlSource || "").trim();
  const token = String(tokenSource || "").trim();

  return { url, token };
}

export async function searchTorznabForQuery(auth, query, options = {}) {
  const { limit = 10 } = options;
  const { url, token } = resolveIndexerSettings(auth, {});

  if (!url || !token) {
    return {
      ok: false,
      skipped: true,
      message: "Indexer Torznab non configuré",
      items: [],
    };
  }

  const searchUrl = buildTorznabSearchUrl(url, token, String(query || "").trim(), limit);
  const response = await fetchWithTimeout(searchUrl);
  const xmlText = await response.text();
  const parsed = parseTorznabResponse(xmlText);

  debugLog("Torznab search response", {
    url: redactTorznabUrl(searchUrl),
    status: response.status,
    ok: response.ok,
    body: truncateForLogs(xmlText),
  });

  if (!response.ok || !parsed.ok) {
    return {
      ok: false,
      message: parsed.message || `Erreur Torznab (${response.status})`,
      code: parsed.code || null,
      items: [],
    };
  }

  return {
    ok: true,
    message: "Recherche Torznab effectuée",
    sourceTitle: parsed.title || null,
    items: parseTorznabItems(xmlText, limit),
  };
}

export function registerTorznabRoutes(app) {
  app.get("/api/indexer/search", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }

      const query = String(req.query.query || "").trim();
      const limit = Math.min(20, Math.max(1, Number(req.query.limit || 10)));

      if (!query) {
        res.status(400).json({ error: "Le paramètre query est requis" });
        return;
      }

      const result = await searchTorznabForQuery(auth, query, { limit });
      if (!result.ok) {
        res.status(400).json({
          ok: false,
          error: result.message,
          code: result.code || null,
          items: [],
        });
        return;
      }

      res.json({
        ok: true,
        query,
        sourceTitle: result.sourceTitle || null,
        items: result.items,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        res.status(504).json({ error: "La recherche Torznab a expiré" });
        return;
      }

      console.error("Torznab search failed:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Échec de la recherche Torznab",
      });
    }
  });

  app.post("/api/indexer/test", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }

      const { url, token } = resolveIndexerSettings(auth, req.body);

      if (!url) {
        res.status(400).json({ error: "L'URL Torznab est requise" });
        return;
      }

      if (!token) {
        res.status(400).json({ error: "Le jeton API Torznab est requis" });
        return;
      }

      const searchUrl = buildTorznabSearchUrl(url, token, "", 1);
      debugLog("Torznab test request", {
        url: redactTorznabUrl(searchUrl),
      });

      const response = await fetchWithTimeout(searchUrl);
      const xmlText = await response.text();
      debugLog("Torznab test response", {
        status: response.status,
        ok: response.ok,
        body: truncateForLogs(xmlText),
      });

      const parsed = parseTorznabResponse(xmlText);

      if (!response.ok) {
        res.status(response.status).json({
          ok: false,
          error: parsed.message || `Connexion Torznab impossible (${response.status})`,
        });
        return;
      }

      if (!parsed.ok) {
        res.status(400).json({ ok: false, error: parsed.message });
        return;
      }

      res.json({
        ok: true,
        message: parsed.title
          ? `Connexion Torznab OK: ${parsed.title}`
          : "Connexion Torznab OK",
        endpoint: searchUrl.origin,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        debugLog("Torznab test timeout", { timeoutMs: torznabTimeoutMs });
        res.status(504).json({ error: "Le test Torznab a expiré" });
        return;
      }

      console.error("Torznab test failed:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Échec du test Torznab",
      });
    }
  });
}
