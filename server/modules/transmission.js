import { requireAuth } from "./auth.js";
import { debugLog } from "../logger.js";
import { promises as fs } from "node:fs";
import { appTorrentsFilePath, dataDir } from "../config.js";
import { addNotification, sendDiscordNotification } from "./notifications.js";
import { getTranslator } from "../i18n.js";

const transmissionTimeoutMs = 8000;
const transmissionRpcPath = "/transmission/rpc";
const transmissionStatusLabels = {
  0: "Stopped",
  1: "Queued to check files",
  2: "Checking files",
  3: "Queued to download",
  4: "Downloading",
  5: "Queued to seed",
  6: "Seeding",
};

async function ensureAppTorrentsStore() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(appTorrentsFilePath);
  } catch {
    await fs.writeFile(appTorrentsFilePath, "{}", "utf-8");
  }
}

async function readAppTorrentsStore() {
  await ensureAppTorrentsStore();
  const content = await fs.readFile(appTorrentsFilePath, "utf-8");
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

async function writeAppTorrentsStore(data) {
  await ensureAppTorrentsStore();
  await fs.writeFile(appTorrentsFilePath, JSON.stringify(data, null, 2), "utf-8");
}

async function registerAppTorrentForUser(userId, torrent) {
  const hash = String(torrent?.hashString || "").trim().toLowerCase();
  if (!hash) {
    return;
  }

  const store = await readAppTorrentsStore();
  const key = String(userId);
  const existing = Array.isArray(store[key]) ? store[key] : [];
  const merged = Array.from(new Set([...existing, hash]));
  store[key] = merged;
  await writeAppTorrentsStore(store);
}

async function getAppTorrentHashesForUser(userId) {
  const store = await readAppTorrentsStore();
  const values = Array.isArray(store[String(userId)]) ? store[String(userId)] : [];
  return new Set(
    values
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean)
  );
}

async function removeAppTorrentForUser(userId, hash) {
  const torrentHash = String(hash || "").trim().toLowerCase();
  if (!torrentHash) {
    return;
  }

  const store = await readAppTorrentsStore();
  const key = String(userId);
  const existing = Array.isArray(store[key]) ? store[key] : [];
  const filtered = existing.filter((h) => String(h || "").trim().toLowerCase() !== torrentHash);
  store[key] = filtered;
  await writeAppTorrentsStore(store);
}

function buildTransmissionRpcUrl(rawUrl, rawPort) {
  let url;

  try {
    url = new URL(String(rawUrl || "").trim());
  } catch {
    throw new Error("URL Transmission invalide");
  }

  if (rawPort) {
    url.port = String(rawPort).trim();
  }

  if (!url.pathname || url.pathname === "/") {
    url.pathname = transmissionRpcPath;
  } else if (!url.pathname.endsWith(transmissionRpcPath)) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}${transmissionRpcPath}`;
  }

  url.search = "";
  return url;
}

function createAuthHeaders(authRequired, username, password) {
  if (!authRequired) {
    return {};
  }

  if (!username || !password) {
    throw new Error("Nom d'utilisateur et mot de passe Transmission requis");
  }

  const credentials = Buffer.from(`${username}:${password}`).toString("base64");
  return {
    Authorization: `Basic ${credentials}`,
  };
}

async function postTransmissionRpc(url, headers, sessionId, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), transmissionTimeoutMs);

  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...headers,
        ...(sessionId ? { "X-Transmission-Session-Id": sessionId } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isMagnetLink(value) {
  return String(value || "").trim().toLowerCase().startsWith("magnet:?");
}

async function fetchTorrentMetainfo(torrentUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), transmissionTimeoutMs);

  try {
    const response = await fetch(torrentUrl, {
      headers: {
        Accept: "application/x-bittorrent,application/octet-stream,*/*;q=0.1",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Impossible de télécharger le fichier torrent (${response.status})`);
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/html")) {
      throw new Error("Le lien fourni n'est pas un fichier torrent valide");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      throw new Error("Le fichier torrent est vide");
    }

    return buffer.toString("base64");
  } finally {
    clearTimeout(timeout);
  }
}

async function executeTransmissionRpc(url, headers, payload) {
  const firstResponse = await postTransmissionRpc(url, headers, undefined, payload);

  if (firstResponse.status === 409) {
    const sessionId = firstResponse.headers.get("X-Transmission-Session-Id");
    if (!sessionId) {
      throw new Error("Transmission n'a pas fourni d'identifiant de session RPC");
    }

    return postTransmissionRpc(url, headers, sessionId, payload);
  }

  return firstResponse;
}

function resolveTorrentSettings(auth, body) {
  const savedTorrent = auth.user.settings?.placeholders?.torrent || {};

  const hasBodyPassword =
    body && typeof body === "object" && Object.hasOwn(body, "password");
  const passwordSource = hasBodyPassword ? body.password : savedTorrent.password;

  return {
    url: String(body?.url || savedTorrent.url || "").trim(),
    port: String(body?.port || savedTorrent.port || "").trim(),
    authRequired: Boolean(body?.authRequired ?? savedTorrent.authRequired),
    username: String(body?.username || savedTorrent.username || "").trim(),
    password: String(passwordSource || "").trim(),
  };
}

function resolveDownloadDir(auth, mediaType) {
  const torrentSettings = auth.user.settings?.placeholders?.torrent || {};
  const normalizedMediaType = String(mediaType || "movie").trim().toLowerCase();

  if (normalizedMediaType === "series") {
    return String(torrentSettings.seriesFolder || "").trim();
  }

  return String(torrentSettings.moviesFolder || "").trim();
}

async function createAndSendNotification(userId, notification) {
  try {
    // Create in-app notification
    await addNotification(userId, notification);

    // Send to Discord if webhook is configured
    // Note: We don't have auth here, so we can't easily get the webhook
    // This is a limitation of the current architecture
  } catch (error) {
    debugLog("Failed to create notification:", error);
  }
}

export function registerTransmissionRoutes(app) {
  app.post("/api/torrent/test", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }
      const t = getTranslator(req, auth.user);

      const settings = resolveTorrentSettings(auth, req.body);
      if (!settings.url) {
        res.status(400).json({ error: t("transmission.urlRequired") });
        return;
      }

      const rpcUrl = buildTransmissionRpcUrl(settings.url, settings.port);
      const authHeaders = createAuthHeaders(
        settings.authRequired,
        settings.username,
        settings.password
      );

      const response = await executeTransmissionRpc(rpcUrl, authHeaders, {
        method: "session-get",
      });

      if (response.status === 401) {
        res.status(401).json({ error: t("transmission.invalidCredentials") });
        return;
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        res.status(response.status).json({
          error: data?.result || t("transmission.connectFailed", { status: response.status }),
        });
        return;
      }

      if (data?.result !== "success") {
        res.status(400).json({
          error: data?.result || t("transmission.invalidResponse"),
        });
        return;
      }

      res.json({
        ok: true,
        message: data?.arguments?.version
          ? t("transmission.connectOkWithVersion", { version: data.arguments.version })
          : t("transmission.connectOk"),
        endpoint: rpcUrl.origin,
      });
    } catch (error) {
      const t = getTranslator(req);
      if (error instanceof Error && error.name === "AbortError") {
        res.status(504).json({ error: t("transmission.testTimeout") });
        return;
      }

      debugLog("Transmission test failed:", error);
      res.status(500).json({
        error: t("transmission.testFailed"),
      });
    }
  });

  app.post("/api/torrent/add", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }
      const t = getTranslator(req, auth.user);

      const settings = resolveTorrentSettings(auth, req.body);
      const torrentUrl = String(req.body?.torrentUrl || "").trim();
      const mediaType = String(req.body?.mediaType || "movie").trim().toLowerCase();
      if (!settings.url) {
        res.status(400).json({ error: t("transmission.urlRequired") });
        return;
      }

      if (!torrentUrl) {
        res.status(400).json({ error: t("transmission.torrentUrlRequired") });
        return;
      }

      const downloadDir = resolveDownloadDir(auth, mediaType);
      const rpcUrl = buildTransmissionRpcUrl(settings.url, settings.port);
      const authHeaders = createAuthHeaders(
        settings.authRequired,
        settings.username,
        settings.password
      );

      const payload = {
        method: "torrent-add",
        arguments: {
          paused: false,
          ...(downloadDir ? { "download-dir": downloadDir } : {}),
          ...(isMagnetLink(torrentUrl)
            ? { filename: torrentUrl }
            : { metainfo: await fetchTorrentMetainfo(torrentUrl) }),
        },
      };

      const response = await executeTransmissionRpc(rpcUrl, authHeaders, payload);
      if (response.status === 401) {
        res.status(401).json({ error: t("transmission.invalidCredentials") });
        return;
      }

      const data = await response.json().catch(() => null);
      if (!response.ok || data?.result !== "success") {
        res.status(response.ok ? 400 : response.status).json({
          error: data?.result || t("transmission.addToClientFailed", { status: response.status }),
        });
        return;
      }

      const added = data?.arguments?.["torrent-added"] || data?.arguments?.["torrent-duplicate"] || null;
      await registerAppTorrentForUser(auth.user.id, added);

      // Create notification
      const isDuplicate = Boolean(data?.arguments?.["torrent-duplicate"]);
      const torrentName = added?.name || "Torrent";
      await createAndSendNotification(auth.user.id, {
        title: isDuplicate ? t("transmission.duplicateTitle") : t("transmission.addedTitle"),
        message: `${torrentName}`,
        type: isDuplicate ? "warning" : "success",
        data: {
          details: {
            name: torrentName,
            status: isDuplicate ? t("transmission.duplicateStatus") : t("transmission.addedStatus"),
          },
        },
      });

      res.json({
        ok: true,
        message: t("transmission.addedToClient"),
        duplicate: isDuplicate,
        torrent: added,
      });
    } catch (error) {
      const t = getTranslator(req);
      if (error instanceof Error && error.name === "AbortError") {
        res.status(504).json({ error: t("transmission.addTimeout") });
        return;
      }

      debugLog("Add torrent failed:", error);
      res.status(500).json({
        error: t("transmission.addFailed"),
      });
    }
  });

  app.get("/api/torrent/downloads", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }
      const t = getTranslator(req, auth.user);

      const settings = resolveTorrentSettings(auth, req.query);
      if (!settings.url) {
        res.status(400).json({ error: t("transmission.urlRequired") });
        return;
      }

      const rpcUrl = buildTransmissionRpcUrl(settings.url, settings.port);
      const authHeaders = createAuthHeaders(
        settings.authRequired,
        settings.username,
        settings.password
      );

      const response = await executeTransmissionRpc(rpcUrl, authHeaders, {
        method: "torrent-get",
        arguments: {
          fields: [
            "id",
            "hashString",
            "name",
            "status",
            "percentDone",
            "rateDownload",
            "eta",
            "totalSize",
            "downloadDir",
            "addedDate",
            "isFinished",
            "leftUntilDone",
            "error",
            "errorString",
            "peersConnected",
          ],
        },
      });

      if (response.status === 401) {
        res.status(401).json({ error: t("transmission.invalidCredentials") });
        return;
      }

      const data = await response.json().catch(() => null);
      if (!response.ok || data?.result !== "success") {
        res.status(response.ok ? 400 : response.status).json({
          error: data?.result || t("transmission.readDownloadsFailed", { status: response.status }),
        });
        return;
      }

      const allowedHashes = await getAppTorrentHashesForUser(auth.user.id);
      const torrents = Array.isArray(data?.arguments?.torrents)
        ? data.arguments.torrents
            .filter((torrent) => {
              const hash = String(torrent?.hashString || "").trim().toLowerCase();
              return hash && allowedHashes.has(hash);
            })
            .map((torrent) => ({
              id: torrent.id,
              hashString: torrent.hashString,
              name: torrent.name,
              status: torrent.status,
              statusLabel: transmissionStatusLabels[torrent.status] || "Unknown",
              progress: Math.round(Number(torrent.percentDone || 0) * 1000) / 10,
              rateDownload: Number(torrent.rateDownload || 0),
              eta: Number(torrent.eta || 0),
              totalSize: Number(torrent.totalSize || 0),
              downloadDir: torrent.downloadDir,
              addedDate: torrent.addedDate,
              isFinished: Boolean(torrent.isFinished),
              leftUntilDone: Number(torrent.leftUntilDone || 0),
              peersConnected: Number(torrent.peersConnected || 0),
              error: Number(torrent.error || 0),
              errorString: torrent.errorString || "",
            }))
        : [];

      res.json({
        ok: true,
        torrents,
        activeCount: torrents.filter((torrent) => [3, 4, 5, 6].includes(torrent.status)).length,
      });
    } catch (error) {
      const t = getTranslator(req);
      if (error instanceof Error && error.name === "AbortError") {
        res.status(504).json({ error: t("transmission.downloadsTimeout") });
        return;
      }

      debugLog("Get downloads failed:", error);
      res.status(500).json({
        error: t("transmission.downloadsFailed"),
      });
    }
  });

  app.post("/api/torrent/pause", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }
      const t = getTranslator(req, auth.user);

      const torrentId = Number(req.body?.id);
      if (!Number.isFinite(torrentId)) {
        res.status(400).json({ error: t("transmission.invalidTorrentId") });
        return;
      }

      const settings = resolveTorrentSettings(auth, req.body);
      if (!settings.url) {
        res.status(400).json({ error: t("transmission.urlRequired") });
        return;
      }

      const rpcUrl = buildTransmissionRpcUrl(settings.url, settings.port);
      const authHeaders = createAuthHeaders(
        settings.authRequired,
        settings.username,
        settings.password
      );

      const response = await executeTransmissionRpc(rpcUrl, authHeaders, {
        method: "torrent-set",
        arguments: {
          ids: [torrentId],
        },
      });

      if (response.status === 401) {
        res.status(401).json({ error: t("transmission.invalidCredentials") });
        return;
      }

      const data = await response.json().catch(() => null);
      if (!response.ok || data?.result !== "success") {
        res.status(response.ok ? 400 : response.status).json({
          error: data?.result || t("transmission.pauseFailed"),
        });
        return;
      }

      // Send torrent-stop command after setting fields
      const stopResponse = await executeTransmissionRpc(rpcUrl, authHeaders, {
        method: "torrent-stop",
        arguments: {
          ids: [torrentId],
        },
      });

      if (stopResponse.status !== 200) {
        const stopData = await stopResponse.json().catch(() => null);
        if (stopData?.result !== "success") {
          res.status(stopResponse.ok ? 400 : stopResponse.status).json({
            error: stopData?.result || t("transmission.pauseFailed"),
          });
          return;
        }
      }

      res.json({ ok: true, message: t("transmission.paused") });
    } catch (error) {
      const t = getTranslator(req);
      debugLog("Pause torrent failed:", error);
      res.status(500).json({
        error: t("transmission.pauseFailed"),
      });
    }
  });

  app.post("/api/torrent/resume", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }
      const t = getTranslator(req, auth.user);

      const torrentId = Number(req.body?.id);
      if (!Number.isFinite(torrentId)) {
        res.status(400).json({ error: t("transmission.invalidTorrentId") });
        return;
      }

      const settings = resolveTorrentSettings(auth, req.body);
      if (!settings.url) {
        res.status(400).json({ error: t("transmission.urlRequired") });
        return;
      }

      const rpcUrl = buildTransmissionRpcUrl(settings.url, settings.port);
      const authHeaders = createAuthHeaders(
        settings.authRequired,
        settings.username,
        settings.password
      );

      const response = await executeTransmissionRpc(rpcUrl, authHeaders, {
        method: "torrent-start",
        arguments: {
          ids: [torrentId],
        },
      });

      if (response.status === 401) {
        res.status(401).json({ error: t("transmission.invalidCredentials") });
        return;
      }

      const data = await response.json().catch(() => null);
      if (!response.ok || data?.result !== "success") {
        res.status(response.ok ? 400 : response.status).json({
          error: data?.result || t("transmission.resumeFailed"),
        });
        return;
      }

      res.json({ ok: true, message: t("transmission.resumed") });
    } catch (error) {
      const t = getTranslator(req);
      debugLog("Resume torrent failed:", error);
      res.status(500).json({
        error: t("transmission.resumeFailed"),
      });
    }
  });

  app.post("/api/torrent/clean", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }
      const t = getTranslator(req, auth.user);

      const torrentHash = String(req.body?.hash || "").trim().toLowerCase();
      if (!torrentHash) {
        res.status(400).json({ error: t("transmission.invalidHash") });
        return;
      }

      // Remove torrent from app store
      await removeAppTorrentForUser(auth.user.id, torrentHash);

      res.json({ ok: true, message: t("transmission.cleaned") });
    } catch (error) {
      const t = getTranslator(req);
      debugLog("Clean torrent failed:", error);
      res.status(500).json({
        error: t("transmission.cleanFailed"),
      });
    }
  });
}