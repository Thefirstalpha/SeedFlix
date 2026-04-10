import { withAuth } from "./auth.js";
import { debugLog } from "../logger.js";
import { getTranslator } from "../i18n.js";

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

function extractLanguageFromTitle(title) {
  const normalized = String(title || "").toLowerCase();

  if (/\bvostfr\b/i.test(normalized)) {
    return "VOSTFR";
  }
  if (/\bvfq\b/i.test(normalized)) {
    return "VFQ";
  }
  if (/\bvff\b/i.test(normalized)) {
    return "VFF";
  }
  if (/\bmulti\b/i.test(normalized)) {
    return "MULTI";
  }
  if (/\btruefrench\b|\bfrench\b|\bvf\b/i.test(normalized)) {
    return "VF";
  }
  if (/\bvo\b/i.test(normalized)) {
    return "VO";
  }

  return null;
}

function buildTorznabSearchUrl(
  rawUrl,
  apiKey,
  query = "",
  limit = 1,
  tmdbId = "",
  offset = 0,
  invalidUrlMessage = "URL Torznab invalide"
) {
  let url;

  try {
    url = new URL(String(rawUrl || "").trim());
  } catch {
    throw new Error(invalidUrlMessage);
  }

  url.searchParams.set("t", "search");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(Math.max(0, Number(offset) || 0)));
  if (query) {
    url.searchParams.set("q", query);
  }
  if (tmdbId) {
    // Many Torznab indexers support tmdbid filtering.
    url.searchParams.set("tmdbid", String(tmdbId));
  }
  if (apiKey) {
    url.searchParams.set("apikey", apiKey);
  }

  return url;
}

function parseTorznabResponse(xmlText, invalidSearchResponseMessage) {
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
      message: invalidSearchResponseMessage,
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
    const enclosureUrlMatch = block.match(/<enclosure[^>]*url="([^"]+)"[^>]*>/i);
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

    const lowerCaseAttributes = Object.fromEntries(
      Object.entries(attributes).map(([key, value]) => [String(key || "").toLowerCase(), value])
    );
    const qualityFromAttributes =
      lowerCaseAttributes.resolution ||
      lowerCaseAttributes.quality ||
      lowerCaseAttributes.video ||
      null;
    const tmdbId = String(
      lowerCaseAttributes.tmdbid ||
      lowerCaseAttributes["tmdb-id"] ||
      ""
    ).trim();
    const quality = qualityFromAttributes || extractQualityFromTitle(title);
    const language =
      lowerCaseAttributes.language ||
      lowerCaseAttributes.lang ||
      lowerCaseAttributes.audio ||
      lowerCaseAttributes.languages ||
      lowerCaseAttributes["languagefrench"] ||
      extractLanguageFromTitle(title) ||
      null;
    const downloadUrl =
      lowerCaseAttributes.magneturl ||
      decodeXmlEntities(enclosureUrlMatch?.[1] || "").trim() ||
      decodeXmlEntities(linkMatch?.[1]?.trim() || "");

    const size = Number(sizeMatch?.[1] || 0) || null;

    items.push({
      title,
      link: decodeXmlEntities(linkMatch?.[1]?.trim() || ""),
      downloadUrl,
      guid: decodeXmlEntities(guidMatch?.[1]?.trim() || ""),
      pubDate: decodeXmlEntities(pubDateMatch?.[1]?.trim() || ""),
      size,
      sizeHuman: size ? bytesToHuman(size) : null,
      seeders: Number(seedersMatch?.[1] || 0) || null,
      leechers: Number(leechersMatch?.[1] || 0) || null,
      tmdbId: tmdbId || null,
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
      return sizeA - sizeB;
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
  const { limit = 10, tmdbId = "" } = options;
  const t = options.t || ((key) => key);
  const { url, token } = resolveIndexerSettings(auth, {});

  if (!url || !token) {
    return {
      ok: false,
      skipped: true,
      message: t("torznab.indexerNotConfigured"),
      items: [],
    };
  }

  const normalizedTmdbId = String(tmdbId || "").trim();
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit || 10)));
  const pageRequestLimit = Math.min(normalizedLimit, 100);
  const maxPages = 10;

  let offset = 0;
  let pageCount = 0;
  let detectedPageSize = 0;
  const aggregatedItems = [];
  let lastSourceTitle = null;

  while (aggregatedItems.length < normalizedLimit && pageCount < maxPages) {
    const searchUrl = buildTorznabSearchUrl(
      url,
      token,
      String(query || "").trim(),
      pageRequestLimit,
      normalizedTmdbId,
      offset,
      t("torznab.invalidUrl")
    );

    const response = await fetchWithTimeout(searchUrl);
    const xmlText = await response.text();
    const parsed = parseTorznabResponse(xmlText, t("torznab.invalidSearchResponse"));

    debugLog("Torznab search response", {
      page: pageCount + 1,
      offset,
      url: redactTorznabUrl(searchUrl),
      status: response.status,
      ok: response.ok,
      body: truncateForLogs(xmlText),
    });

    if (!response.ok || !parsed.ok) {
      if (pageCount === 0) {
        return {
          ok: false,
          message: parsed.message || t("torznab.genericError", { status: response.status }),
          code: parsed.code || null,
          items: [],
        };
      }
      break;
    }

    lastSourceTitle = parsed.title || lastSourceTitle;

    const pageItems = parseTorznabItems(xmlText, pageRequestLimit);
    const filteredPageItems = normalizedTmdbId
      ? pageItems.filter((item) => String(item.tmdbId || "").trim() === normalizedTmdbId)
      : pageItems;

    if (!filteredPageItems.length) {
      break;
    }

    if (!detectedPageSize) {
      detectedPageSize = filteredPageItems.length;
    }

    for (const item of filteredPageItems) {
      const duplicate = aggregatedItems.some((existing) => {
        if (item.guid && existing.guid) {
          return item.guid === existing.guid;
        }
        if (item.downloadUrl && existing.downloadUrl) {
          return item.downloadUrl === existing.downloadUrl;
        }
        return item.title === existing.title;
      });

      if (!duplicate) {
        aggregatedItems.push(item);
      }

      if (aggregatedItems.length >= normalizedLimit) {
        break;
      }
    }

    const currentPageSize = filteredPageItems.length;
    offset += currentPageSize;
    pageCount += 1;

    if (detectedPageSize && currentPageSize < detectedPageSize) {
      break;
    }
  }

  return {
    ok: true,
    message: t("torznab.searchDone"),
    sourceTitle: lastSourceTitle || null,
    items: aggregatedItems.slice(0, normalizedLimit),
  };
}

export function registerTorznabRoutes(app) {
  app.get("/api/indexer/search", withAuth(async (req, res, auth) => {
    try {
      const t = getTranslator(req, auth.user);

      const query = String(req.query.query || "").trim();
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
      const tmdbId = String(req.query.tmdbId || "").trim();

      if (!query) {
        res.status(400).json({ error: t("torznab.queryRequired") });
        return;
      }

      const result = await searchTorznabForQuery(auth, query, { limit, tmdbId, t });
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
        tmdbId: tmdbId || null,
        sourceTitle: result.sourceTitle || null,
        items: result.items,
      });
    } catch (error) {
      const t = getTranslator(req);
      if (error instanceof Error && error.name === "AbortError") {
        res.status(504).json({ error: t("torznab.searchTimeout") });
        return;
      }

      debugLog("Torznab search failed:", error);
      res.status(500).json({
        error: t("torznab.searchFailed"),
      });
    }
  }));

  app.post("/api/indexer/test", withAuth(async (req, res, auth) => {
    try {
      const t = getTranslator(req, auth.user);

      const { url, token } = resolveIndexerSettings(auth, req.body);

      if (!url) {
        res.status(400).json({ error: t("torznab.urlRequired") });
        return;
      }

      if (!token) {
        res.status(400).json({ error: t("torznab.tokenRequired") });
        return;
      }

      const searchUrl = buildTorznabSearchUrl(url, token, "", 1, "", 0, t("torznab.invalidUrl"));
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

      const parsed = parseTorznabResponse(xmlText, t("torznab.invalidSearchResponse"));

      if (!response.ok) {
        res.status(response.status).json({
          ok: false,
          error: parsed.message || t("torznab.connectFailed", { status: response.status }),
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
          ? t("torznab.connectOkWithTitle", { title: parsed.title })
          : t("torznab.connectOk"),
        endpoint: searchUrl.origin,
      });
    } catch (error) {
      const t = getTranslator(req);
      if (error instanceof Error && error.name === "AbortError") {
        debugLog("Torznab test timeout", { timeoutMs: torznabTimeoutMs });
        res.status(504).json({ error: t("torznab.testTimeout") });
        return;
      }

      debugLog("Torznab test failed:", error);
      res.status(500).json({
        error: t("torznab.testFailed"),
      });
    }
  }));
}
