import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Supabase if credentials are provided in env and are valid
  const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim();
  let supabase: any = null;

  const isValidUrl = (url?: string): boolean => {
    if (!url) return false;
    return url.startsWith("http://") || url.startsWith("https://");
  };

  if (SUPABASE_URL && SUPABASE_ANON_KEY && isValidUrl(SUPABASE_URL)) {
    try {
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("Supabase client initialized successfully.");
    } catch (err) {
      console.error("Failed to initialize Supabase client:", err);
    }
  } else {
    console.log("Supabase URL or Key not found or invalid in environment. Falling back to local custom_songs.json file storage.");
  }

  // Path to persist shared custom songs on the server
  const CUSTOM_SONGS_FILE = path.join(process.cwd(), "custom_songs.json");

  // Helper to read custom songs safely
  function readCustomSongs() {
    try {
      if (fs.existsSync(CUSTOM_SONGS_FILE)) {
        const data = fs.readFileSync(CUSTOM_SONGS_FILE, "utf-8");
        return JSON.parse(data);
      }
    } catch (err) {
      console.error("Error reading custom songs file:", err);
    }
    return [];
  }

  // Helper to write custom songs safely
  function writeCustomSongs(songs: any[]) {
    try {
      fs.writeFileSync(CUSTOM_SONGS_FILE, JSON.stringify(songs, null, 2), "utf-8");
    } catch (err) {
      console.error("Error writing custom songs file:", err);
    }
  }

  // In-memory state store for the projector/karaoke sync
  let projectorState: any = {
    type: 'sync',
    song: null,
    playState: 'idle',
    countdown: 3,
    score: 0,
    songTime: 0,
    currentUser: ''
  };

  // API route for custom songs shared among all users
  app.get("/api/custom-songs", async (req, res) => {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("custom_songs")
          .select("*")
          .order("created_at", { ascending: true });

        if (error) {
          throw error;
        }

        // Map snake_case database columns to camelCase properties for the React client
        const mappedSongs = data.map((song: any) => ({
          id: song.id,
          title: song.title,
          category: song.category,
          numberOrYear: song.number_or_year,
          artist: song.artist,
          bpm: song.bpm,
          difficulty: song.difficulty,
          lyrics: song.lyrics,
          melody: song.melody,
          description: song.description,
          language: song.language,
        }));

        return res.json(mappedSongs);
      } catch (err) {
        console.error("Error fetching from Supabase, falling back to local file:", err);
        return res.json(readCustomSongs());
      }
    } else {
      return res.json(readCustomSongs());
    }
  });

  app.post("/api/custom-songs", async (req, res) => {
    const songs = req.body;
    if (!Array.isArray(songs)) {
      return res.status(400).json({ error: "Invalid songs list data type" });
    }

    // Always write locally as a secondary backup / local storage fallback
    writeCustomSongs(songs);

    if (supabase) {
      try {
        // Map camelCase to snake_case for Supabase columns
        const mappedSongs = songs.map((song: any) => ({
          id: song.id,
          title: song.title,
          category: song.category,
          number_or_year: song.numberOrYear,
          artist: song.artist,
          bpm: song.bpm,
          difficulty: song.difficulty,
          lyrics: song.lyrics,
          melody: song.melody,
          description: song.description || null,
          language: song.language || null,
        }));

        const { error } = await supabase
          .from("custom_songs")
          .upsert(mappedSongs, { onConflict: "id" });

        if (error) {
          throw error;
        }

        return res.json({ success: true, database: "supabase" });
      } catch (err) {
        console.error("Error upserting to Supabase:", err);
        return res.json({ success: true, database: "local", warning: "Supabase write failed, saved locally" });
      }
    } else {
      return res.json({ success: true, database: "local" });
    }
  });

  // API routes for projector sync
  app.post("/api/projector/sync", (req, res) => {
    // Merge any properties received in the body to make the sync fully flexible
    projectorState = {
      ...projectorState,
      ...req.body
    };
    res.json({ success: true, state: projectorState });
  });

  app.post("/api/projector/time", (req, res) => {
    const { songTime, playState } = req.body;
    if (songTime !== undefined) projectorState.songTime = songTime;
    if (playState !== undefined) projectorState.playState = playState;
    res.json({ success: true, songTime: projectorState.songTime });
  });

  app.get("/api/projector/state", (req, res) => {
    res.json(projectorState);
  });

  app.post("/api/projector/reset", (req, res) => {
    projectorState = {
      type: 'sync',
      song: null,
      playState: 'idle',
      countdown: 3,
      score: 0,
      songTime: 0,
      currentUser: ''
    };
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
