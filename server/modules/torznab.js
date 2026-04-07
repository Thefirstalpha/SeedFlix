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

function buildTorznabSearchUrl(rawUrl, apiKey) {
  let url;

  try {
    url = new URL(String(rawUrl || "").trim());
  } catch {
    throw new Error("URL Torznab invalide");
  }

  url.searchParams.set("t", "search");
  url.searchParams.set("limit", "1");
  if (apiKey) {
    url.searchParams.set("apikey", apiKey);
  }

  return url;
}

function parseTorznabResponse(xmlText) {
  const errorMatch = xmlText.match(/<error[^>]*description="([^"]+)"/i);
  if (errorMatch) {
    return {
      ok: false,
      message: errorMatch[1],
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

export function registerTorznabRoutes(app) {
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

      const searchUrl = buildTorznabSearchUrl(url, token);
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