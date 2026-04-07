import "dotenv/config";
import express from "express";
import cors from "cors";
import { isDebugMode, port } from "./config.js";
import { debugLog } from "./logger.js";
import { registerAuthRoutes } from "./modules/auth.js";
import { registerTransmissionRoutes } from "./modules/transmission.js";
import { registerTorznabRoutes } from "./modules/torznab.js";
import { registerTmdbRoutes } from "./modules/tmdb.js";
import { registerWishlistRoutes } from "./modules/wishlist.js";

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

// ─────────────────────────────────────────────────────────────────────────────

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
  debugLog("Server startup complete");
});
