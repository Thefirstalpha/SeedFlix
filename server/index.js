import "dotenv/config";
import express from "express";
import cors from "cors";
import { port } from "./config.js";
import { registerAuthRoutes } from "./modules/auth.js";
import { registerTmdbRoutes } from "./modules/tmdb.js";
import { registerWishlistRoutes } from "./modules/wishlist.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

registerAuthRoutes(app);
registerWishlistRoutes(app);
registerTmdbRoutes(app);

// ─────────────────────────────────────────────────────────────────────────────

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
