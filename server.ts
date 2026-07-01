import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
