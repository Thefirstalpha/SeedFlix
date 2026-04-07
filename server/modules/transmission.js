import { requireAuth } from "./auth.js";

const transmissionTimeoutMs = 8000;
const transmissionRpcPath = "/transmission/rpc";

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

async function postTransmissionRpc(url, headers, sessionId) {
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
      body: JSON.stringify({ method: "session-get" }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function executeTransmissionSessionGet(url, headers) {
  const firstResponse = await postTransmissionRpc(url, headers);

  if (firstResponse.status === 409) {
    const sessionId = firstResponse.headers.get("X-Transmission-Session-Id");
    if (!sessionId) {
      throw new Error("Transmission n'a pas fourni d'identifiant de session RPC");
    }

    return postTransmissionRpc(url, headers, sessionId);
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

export function registerTransmissionRoutes(app) {
  app.post("/api/torrent/test", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }

      const settings = resolveTorrentSettings(auth, req.body);
      if (!settings.url) {
        res.status(400).json({ error: "L'URL Transmission est requise" });
        return;
      }

      const rpcUrl = buildTransmissionRpcUrl(settings.url, settings.port);
      const authHeaders = createAuthHeaders(
        settings.authRequired,
        settings.username,
        settings.password
      );

      const response = await executeTransmissionSessionGet(rpcUrl, authHeaders);

      if (response.status === 401) {
        res.status(401).json({ error: "Identifiants Transmission invalides" });
        return;
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        res.status(response.status).json({
          error:
            data?.result || `Connexion Transmission impossible (${response.status})`,
        });
        return;
      }

      if (data?.result !== "success") {
        res.status(400).json({
          error: data?.result || "Réponse Transmission invalide",
        });
        return;
      }

      res.json({
        ok: true,
        message: data?.arguments?.version
          ? `Connexion Transmission OK: ${data.arguments.version}`
          : "Connexion Transmission OK",
        endpoint: rpcUrl.origin,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        res.status(504).json({ error: "Le test Transmission a expiré" });
        return;
      }

      console.error("Transmission test failed:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Échec du test Transmission",
      });
    }
  });
}