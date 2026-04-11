import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDebugMode, isRequestLogEnabled, port } from "./config.js";
import { debugLog, errorLog, infoLog, requestLog } from "./logger.js";
import { initializeAuthStores, registerAuthRoutes } from "./modules/auth.js";
import { initializeDatabase } from "./db.js";
import { registerTransmissionRoutes, startCompletedTorrentsPolling } from "./modules/transmission.js";
import { registerTorznabRoutes } from "./modules/torznab.js";
import { registerTmdbRoutes } from "./modules/tmdb.js";
import { registerWishlistRoutes } from "./modules/wishlist.js";
import { registerNotificationRoutes } from "./modules/notifications.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistDir = path.resolve(__dirname, "../dist");

const app = express();

app.use(cors());
app.use(express.json());

if (isRequestLogEnabled) {
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      const elapsedMs = Date.now() - startedAt;
      requestLog(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${elapsedMs}ms)`);
    });
    next();
  });
}

if (isDebugMode) {
  debugLog("Mode debug actif");
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

async function bootstrapAppData() {
  initializeDatabase();
  await initializeAuthStores();
}


// Démarre le polling de complétion des torrents (notification background)
startCompletedTorrentsPolling({ intervalMs: 60000 }); // 1 min par défaut

registerAuthRoutes(app);
registerWishlistRoutes(app);
registerTransmissionRoutes(app);
registerTorznabRoutes(app);
registerTmdbRoutes(app);
registerNotificationRoutes(app);

app.use(express.static(clientDistDir));

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    next();
    return;
  }

  res.sendFile(path.join(clientDistDir, "index.html"));
});

// ─────────────────────────────────────────────────────────────────────────────

const server = app.listen(port, () => {
  infoLog(`API server running on http://localhost:${port}`);
  debugLog("Server startup complete");
});

server.on("error", (error) => {
  errorLog("Server startup failed:", error);
  process.exitCode = 1;
});
