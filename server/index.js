import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDebugMode, port } from "./config.js";
import { debugLog } from "./logger.js";
import { registerAuthRoutes } from "./modules/auth.js";
import { registerTransmissionRoutes } from "./modules/transmission.js";
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

if (isDebugMode) {
  debugLog("Mode debug actif");
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

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

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
  debugLog("Server startup complete");
});
