import { promises as fs } from "node:fs";

import {
  dataDir,
  seriesWishlistFilePath,
  wishlistFilePath,
} from "../config.js";

async function ensureJsonArrayStore(filePath) {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "[]", "utf-8");
  }
}

async function readJsonArrayStore(filePath) {
  await ensureJsonArrayStore(filePath);
  const content = await fs.readFile(filePath, "utf-8");

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeJsonArrayStore(filePath, items) {
  await ensureJsonArrayStore(filePath);
  await fs.writeFile(filePath, JSON.stringify(items, null, 2), "utf-8");
}

export async function readWishlist() {
  return readJsonArrayStore(wishlistFilePath);
}

export async function writeWishlist(wishlist) {
  await writeJsonArrayStore(wishlistFilePath, wishlist);
}

export async function readSeriesWishlist() {
  return readJsonArrayStore(seriesWishlistFilePath);
}

export async function writeSeriesWishlist(wishlist) {
  await writeJsonArrayStore(seriesWishlistFilePath, wishlist);
}

function normalizeMovie(movie) {
  if (!movie || typeof movie !== "object") {
    return null;
  }

  const id = Number(movie.id);
  if (!Number.isFinite(id)) {
    return null;
  }

  return {
    id,
    title: String(movie.title || ""),
    year: Number(movie.year || 0),
    rating: Number(movie.rating || 0),
    genre: String(movie.genre || "Inconnu"),
    poster: String(movie.poster || ""),
    director: String(movie.director || "Non disponible"),
    actors: Array.isArray(movie.actors)
      ? movie.actors.map((actor) => String(actor))
      : [],
    plot: String(movie.plot || ""),
    duration: String(movie.duration || "Non disponible"),
    backdrop: movie.backdrop ? String(movie.backdrop) : undefined,
    originalTitle: movie.originalTitle
      ? String(movie.originalTitle)
      : undefined,
    releaseDate: movie.releaseDate ? String(movie.releaseDate) : undefined,
    voteCount: Number.isFinite(Number(movie.voteCount))
      ? Number(movie.voteCount)
      : undefined,
  };
}

function normalizeSeriesEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const validTypes = ["series", "season", "episode"];
  const type = String(entry.type || "");
  if (!validTypes.includes(type)) {
    return null;
  }

  const seriesId = Number(entry.seriesId);
  if (!Number.isFinite(seriesId)) {
    return null;
  }

  const normalized = {
    type,
    seriesId,
    seriesTitle: String(entry.seriesTitle || ""),
    seriesPoster: String(entry.seriesPoster || ""),
  };

  if (type === "season" || type === "episode") {
    const seasonNumber = Number(entry.seasonNumber);
    if (!Number.isFinite(seasonNumber)) {
      return null;
    }

    normalized.seasonNumber = seasonNumber;
    normalized.seasonName = String(entry.seasonName || `Saison ${seasonNumber}`);
  }

  if (type === "episode") {
    const episodeNumber = Number(entry.episodeNumber);
    if (!Number.isFinite(episodeNumber)) {
      return null;
    }

    normalized.episodeNumber = episodeNumber;
    normalized.episodeName = String(entry.episodeName || "");
  }

  if (type === "series") {
    normalized.entryId = `series_${seriesId}`;
  } else if (type === "season") {
    normalized.entryId = `season_${seriesId}_${normalized.seasonNumber}`;
  } else {
    normalized.entryId = `episode_${seriesId}_${normalized.seasonNumber}_${normalized.episodeNumber}`;
  }

  return normalized;
}

export function registerWishlistRoutes(app) {
  app.get("/api/wishlist", async (_req, res) => {
    try {
      const wishlist = await readWishlist();
      res.json(wishlist);
    } catch (error) {
      console.error("Read wishlist failed:", error);
      res.status(500).json({ error: "Failed to read wishlist" });
    }
  });

  app.post("/api/wishlist", async (req, res) => {
    try {
      const movie = normalizeMovie(req.body);
      if (!movie) {
        res.status(400).json({ error: "Invalid movie payload" });
        return;
      }

      const wishlist = await readWishlist();
      const alreadyExists = wishlist.some((item) => item.id === movie.id);
      if (!alreadyExists) {
        wishlist.push(movie);
        await writeWishlist(wishlist);
      }

      res.status(201).json({ ok: true, exists: alreadyExists });
    } catch (error) {
      console.error("Add wishlist movie failed:", error);
      res.status(500).json({ error: "Failed to add movie to wishlist" });
    }
  });

  app.delete("/api/wishlist/:id", async (req, res) => {
    try {
      const movieId = Number(req.params.id);
      if (!Number.isFinite(movieId)) {
        res.status(400).json({ error: "Invalid movie id" });
        return;
      }

      const wishlist = await readWishlist();
      const updatedWishlist = wishlist.filter((movie) => movie.id !== movieId);
      await writeWishlist(updatedWishlist);
      res.json({ ok: true });
    } catch (error) {
      console.error("Remove wishlist movie failed:", error);
      res.status(500).json({ error: "Failed to remove movie from wishlist" });
    }
  });

  app.delete("/api/wishlist", async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.ids)
        ? req.body.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))
        : [];

      const idsSet = new Set(ids);
      const wishlist = await readWishlist();
      const updatedWishlist = wishlist.filter((movie) => !idsSet.has(movie.id));
      await writeWishlist(updatedWishlist);

      res.json({ ok: true });
    } catch (error) {
      console.error("Remove multiple wishlist movies failed:", error);
      res.status(500).json({ error: "Failed to remove wishlist movies" });
    }
  });

  app.get("/api/wishlist/:id", async (req, res) => {
    try {
      const movieId = Number(req.params.id);
      if (!Number.isFinite(movieId)) {
        res.status(400).json({ error: "Invalid movie id" });
        return;
      }

      const wishlist = await readWishlist();
      const exists = wishlist.some((movie) => movie.id === movieId);
      res.json({ exists });
    } catch (error) {
      console.error("Check wishlist movie failed:", error);
      res.status(500).json({ error: "Failed to check wishlist movie" });
    }
  });

  app.get("/api/series-wishlist", async (_req, res) => {
    try {
      const wishlist = await readSeriesWishlist();
      res.json(wishlist);
    } catch (error) {
      console.error("Read series wishlist failed:", error);
      res.status(500).json({ error: "Failed to read series wishlist" });
    }
  });

  app.get("/api/series-wishlist/series/:seriesId/status", async (req, res) => {
    try {
      const seriesId = Number(req.params.seriesId);
      if (!Number.isFinite(seriesId)) {
        res.status(400).json({ error: "Invalid seriesId" });
        return;
      }

      const wishlist = await readSeriesWishlist();
      const entries = wishlist.filter((entry) => entry.seriesId === seriesId);

      res.json({
        seriesInWishlist: entries.some((entry) => entry.type === "series"),
        seasonsInWishlist: entries
          .filter((entry) => entry.type === "season")
          .map((entry) => entry.seasonNumber),
        episodesInWishlist: entries
          .filter((entry) => entry.type === "episode")
          .map((entry) => ({
            seasonNumber: entry.seasonNumber,
            episodeNumber: entry.episodeNumber,
          })),
      });
    } catch (error) {
      console.error("Series wishlist status failed:", error);
      res.status(500).json({ error: "Failed to get wishlist status" });
    }
  });

  app.post("/api/series-wishlist", async (req, res) => {
    try {
      const entry = normalizeSeriesEntry(req.body);
      if (!entry) {
        res.status(400).json({ error: "Invalid series wishlist payload" });
        return;
      }

      let wishlist = await readSeriesWishlist();

      if (entry.type === "series") {
        wishlist = wishlist.filter((item) => item.seriesId !== entry.seriesId);
        wishlist.push(entry);
      } else if (entry.type === "season") {
        wishlist = wishlist.filter(
          (item) =>
            !(
              item.seriesId === entry.seriesId &&
              item.type === "episode" &&
              item.seasonNumber === entry.seasonNumber
            )
        );

        const coveringSeriesExists = wishlist.some(
          (item) => item.seriesId === entry.seriesId && item.type === "series"
        );

        if (!coveringSeriesExists) {
          wishlist = wishlist.filter((item) => item.entryId !== entry.entryId);
          wishlist.push(entry);
        }
      } else {
        const covered = wishlist.some(
          (item) =>
            item.seriesId === entry.seriesId &&
            (item.type === "series" ||
              (item.type === "season" && item.seasonNumber === entry.seasonNumber))
        );

        if (!covered) {
          wishlist = wishlist.filter((item) => item.entryId !== entry.entryId);
          wishlist.push(entry);
        }
      }

      await writeSeriesWishlist(wishlist);
      res.status(201).json({ ok: true });
    } catch (error) {
      console.error("Add series wishlist entry failed:", error);
      res.status(500).json({ error: "Failed to add to series wishlist" });
    }
  });

  app.delete("/api/series-wishlist/entry/:entryId", async (req, res) => {
    try {
      const entryId = req.params.entryId;
      const wishlist = await readSeriesWishlist();
      const updated = wishlist.filter((entry) => entry.entryId !== entryId);
      await writeSeriesWishlist(updated);
      res.json({ ok: true });
    } catch (error) {
      console.error("Remove series wishlist entry failed:", error);
      res.status(500).json({ error: "Failed to remove series wishlist entry" });
    }
  });

  app.delete("/api/series-wishlist/bulk", async (req, res) => {
    try {
      const entryIds = Array.isArray(req.body?.entryIds)
        ? req.body.entryIds.map((id) => String(id))
        : [];
      const entryIdsSet = new Set(entryIds);
      const wishlist = await readSeriesWishlist();
      const updated = wishlist.filter((entry) => !entryIdsSet.has(entry.entryId));
      await writeSeriesWishlist(updated);
      res.json({ ok: true });
    } catch (error) {
      console.error("Bulk remove series wishlist entries failed:", error);
      res.status(500).json({ error: "Failed to remove series wishlist entries" });
    }
  });
}