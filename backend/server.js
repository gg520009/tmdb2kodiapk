const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const tmdbService = require('./services/tmdbService');
const sourceService = require('./services/sourceService');
const kodiService = require('./services/kodiService');
const proxyService = require('./services/proxyService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve Static Frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// --- TMDB APIs ---
app.get('/api/tmdb/trending', async (req, res) => {
  try {
    const { type, timeWindow, page } = req.query;
    const data = await tmdbService.getTrending(type || 'movie', timeWindow || 'day', page || 1);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tmdb/popular', async (req, res) => {
  try {
    const { type, page } = req.query;
    const data = await tmdbService.getPopular(type || 'movie', page || 1);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tmdb/search', async (req, res) => {
  try {
    const { query, type, page } = req.query;
    const data = await tmdbService.search(query, type || 'multi', page || 1);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tmdb/detail/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const data = await tmdbService.getDetail(type, id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tmdb/tv/:id/season/:season', async (req, res) => {
  try {
    const { id, season } = req.params;
    const data = await tmdbService.getTvSeason(id, season);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Local Replication Library & History ---
app.get('/api/library', (req, res) => {
  res.json(tmdbService.getLibrary());
});

app.post('/api/library', (req, res) => {
  const library = tmdbService.addToLibrary(req.body);
  res.json(library);
});

app.delete('/api/library/:media_type/:id', (req, res) => {
  const { media_type, id } = req.params;
  const library = tmdbService.removeFromLibrary(id, media_type);
  res.json(library);
});

app.get('/api/history', (req, res) => {
  res.json(tmdbService.getWatchHistory());
});

// --- Video Source Manager APIs (Cineby, FMovies, Cineplay, etc.) ---
app.get('/api/sources', (req, res) => {
  res.json(sourceService.getSources());
});

app.post('/api/sources', (req, res) => {
  const sources = sourceService.addSource(req.body);
  res.json(sources);
});

app.put('/api/sources/:id', (req, res) => {
  const sources = sourceService.updateSource(req.params.id, req.body);
  res.json(sources);
});

app.delete('/api/sources/:id', (req, res) => {
  const sources = sourceService.deleteSource(req.params.id);
  res.json(sources);
});

// --- Resolve Streams for TMDB Item ---
app.get('/api/resolve', async (req, res) => {
  try {
    const { type, tmdbId, imdbId, season, episode } = req.query;
    if (!type || !tmdbId) {
      return res.status(400).json({ error: 'Missing type or tmdbId' });
    }

    const streams = await sourceService.resolveStreams(type, tmdbId, imdbId, season || 1, episode || 1);
    res.json({ streams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Kodi Control APIs (JSON-RPC POST) ---
app.post('/api/kodi/play', async (req, res) => {
  try {
    const { url, metadata } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Missing stream URL to play on Kodi' });
    }

    const result = await kodiService.playUrl(url, metadata || {});
    
    // Record to watch history
    if (metadata) {
      tmdbService.addWatchHistory(metadata);
    }

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/kodi/control', async (req, res) => {
  try {
    const { action, value } = req.body;
    const result = await kodiService.control(action, value);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/kodi/status', async (req, res) => {
  const status = await kodiService.getStatus();
  res.json(status);
});

app.get('/api/config', (req, res) => {
  const configPath = path.join(__dirname, 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  res.json(config);
});

app.post('/api/kodi/settings', (req, res) => {
  try {
    const newSettings = kodiService.updateSettings(req.body);
    res.json({ success: true, settings: newSettings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Proxy Stream Streamer ---
app.get('/api/proxy/stream', (req, res) => {
  proxyService.proxyStream(req, res);
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Armbian TMDB-to-Kodi Bridge Server running at:`);
  console.log(` http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
