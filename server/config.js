import path from "node:path";
import { fileURLToPath } from "node:url";

export const port = Number(process.env.PORT || 4000);
export const tmdbApiKey = process.env.TMDB_API_KEY;
export const tmdbBaseUrl = "https://api.themoviedb.org/3";
export const authCookieName = "catalogfinder_session";
export const sessionDurationMs = 1000 * 60 * 60 * 24 * 7;
export const isDebugMode =
	process.argv.includes("--debug") ||
	["1", "true", "yes", "on"].includes(
		String(process.env.DEBUG || "").toLowerCase()
	);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const serverDir = __dirname;
export const dataDir = path.join(serverDir, "data");
export const wishlistFilePath = path.join(dataDir, "wishlist-movies.json");
export const seriesWishlistFilePath = path.join(dataDir, "wishlist-series.json");
export const usersFilePath = path.join(dataDir, "users.json");
export const sessionsFilePath = path.join(dataDir, "sessions.json");
export const appTorrentsFilePath = path.join(dataDir, "app-torrents.json");
export const defaultSettingsFilePath = path.join(serverDir, "defaultSettings.json");