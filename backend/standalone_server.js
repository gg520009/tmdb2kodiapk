const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const CONFIG_FILE = path.join(__dirname, 'config.json');
const DB_FILE = path.join(__dirname, 'data/local_db.json');

// Ensure data dir
if (!fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ library: [], history: [], cache: {} }, null, 2));
}

function getConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function httpGetJson(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(targetUrl);
    const lib = parsed.protocol === 'https:' ? require('https') : require('http');
    const req = lib.get(targetUrl, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({});
        }
      });
    });
    req.on('error', err => reject(err));
  });
}

function httpPostJson(targetUrl, bodyData, auth = null) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(targetUrl);
    const lib = parsed.protocol === 'https:' ? require('https') : require('http');
    const postData = JSON.stringify(bodyData);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    };
    if (auth && auth.username) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${auth.username}:${auth.password||''}`).toString('base64');
    }
    const req = lib.request(targetUrl, { method: 'POST', headers, timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
      });
    });
    req.on('error', err => reject(err));
    req.write(postData);
    req.end();
  });
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API Routes ---
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');

    try {
      if (pathname === '/api/tmdb/trending') {
        const type = parsedUrl.query.type || 'movie';
        const config = getConfig();
        const tmdbUrl = `https://api.themoviedb.org/3/trending/${type}/day?api_key=${config.tmdb.apiKey}&language=zh-CN`;
        const data = await httpGetJson(tmdbUrl);
        res.end(JSON.stringify(data));
        return;
      }

      if (pathname === '/api/tmdb/search') {
        const query = encodeURIComponent(parsedUrl.query.query || '');
        const config = getConfig();
        const tmdbUrl = `https://api.themoviedb.org/3/search/multi?api_key=${config.tmdb.apiKey}&language=zh-CN&query=${query}`;
        const data = await httpGetJson(tmdbUrl);
        res.end(JSON.stringify(data));
        return;
      }

      if (pathname.startsWith('/api/tmdb/detail/')) {
        const parts = pathname.split('/');
        const type = parts[4];
        const id = parts[5];
        const config = getConfig();
        const tmdbUrl = `https://api.themoviedb.org/3/${type}/${id}?api_key=${config.tmdb.apiKey}&language=zh-CN&append_to_response=external_ids`;
        const data = await httpGetJson(tmdbUrl);
        res.end(JSON.stringify(data));
        return;
      }

      if (pathname === '/api/sources') {
        const config = getConfig();
        if (req.method === 'GET') {
          res.end(JSON.stringify(config.sources || []));
        } else if (req.method === 'POST') {
          let body = '';
          req.on('data', c => body += c);
          req.on('end', () => {
            const newSrc = JSON.parse(body);
            newSrc.id = 'src_' + Date.now();
            config.sources = config.sources || [];
            config.sources.push(newSrc);
            saveConfig(config);
            res.end(JSON.stringify(config.sources));
          });
        }
        return;
      }

      if (pathname.startsWith('/api/sources/')) {
        const id = pathname.split('/')[3];
        const config = getConfig();
        if (req.method === 'DELETE') {
          config.sources = (config.sources || []).filter(s => s.id !== id);
          saveConfig(config);
          res.end(JSON.stringify(config.sources));
        } else if (req.method === 'PUT') {
          let body = '';
          req.on('data', c => body += c);
          req.on('end', () => {
            const updateData = JSON.parse(body);
            config.sources = (config.sources || []).map(s => s.id === id ? { ...s, ...updateData } : s);
            saveConfig(config);
            res.end(JSON.stringify(config.sources));
          });
        }
        return;
      }

      if (pathname === '/api/resolve') {
        const { type, tmdbId, imdbId, season, episode } = parsedUrl.query;
        const config = getConfig();
        const sources = (config.sources || []).filter(s => s.enabled);
        const streams = [];

        for (const src of sources) {
          const pathStr = type === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}/${season||1}/${episode||1}`;
          streams.push({
            sourceName: src.name,
            type: 'direct_source',
            quality: 'HD 1080p',
            url: `${src.url.replace(/\/+$/,'')}${pathStr}`
          });
        }

        // Standard fallbacks
        if (type === 'movie') {
          streams.push({ sourceName: 'VidSrc Embed', quality: '1080p', url: `https://vidsrc.me/embed/movie?tmdb=${tmdbId}` });
          streams.push({ sourceName: 'AutoEmbed Provider', quality: '1080p', url: `https://player.autoembed.cc/embed/movie/${tmdbId}` });
        } else {
          streams.push({ sourceName: 'VidSrc Embed', quality: '1080p', url: `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${season||1}&episode=${episode||1}` });
          streams.push({ sourceName: 'AutoEmbed Provider', quality: '1080p', url: `https://player.autoembed.cc/embed/tv/${tmdbId}/${season||1}/${episode||1}` });
        }

        res.end(JSON.stringify({ streams }));
        return;
      }

      if (pathname === '/api/kodi/play') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
          const { url: mediaUrl, metadata } = JSON.parse(body);
          const config = getConfig();
          const kodi = config.kodi || {};
          const targetUrl = `http://${kodi.ip}:${kodi.port}/jsonrpc`;
          
          try {
            // OSD Notification
            await httpPostJson(targetUrl, {
              jsonrpc: '2.0',
              method: 'GUI.ShowNotification',
              params: { title: 'Armbian 投屏', message: metadata.title || 'TMDB 视频', displaytime: 3000 },
              id: 1
            }, kodi);
          } catch (e) {}

          try {
            // Player Open
            const result = await httpPostJson(targetUrl, {
              jsonrpc: '2.0',
              method: 'Player.Open',
              params: { item: { file: mediaUrl } },
              id: Date.now()
            }, kodi);
            res.end(JSON.stringify({ success: true, result }));
          } catch (err) {
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      if (pathname === '/api/kodi/status') {
        const config = getConfig();
        const kodi = config.kodi || {};
        const targetUrl = `http://${kodi.ip}:${kodi.port}/jsonrpc`;
        try {
          const data = await httpPostJson(targetUrl, { jsonrpc: '2.0', method: 'Player.GetActivePlayers', id: 1 }, kodi);
          const isPlaying = data.result && data.result.length > 0;
          res.end(JSON.stringify({ isPlaying, result: data.result }));
        } catch (e) {
          res.end(JSON.stringify({ isPlaying: false, error: e.message }));
        }
        return;
      }

      if (pathname === '/api/config') {
        res.end(JSON.stringify(getConfig()));
        return;
      }

      if (pathname === '/api/kodi/settings') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
          const config = getConfig();
          config.kodi = JSON.parse(body);
          saveConfig(config);
          res.end(JSON.stringify({ success: true, settings: config.kodi }));
        });
        return;
      }

    } catch (err) {
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  // --- Static Files ---
  let filePath = path.join(__dirname, '../frontend', pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('404 Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Standalone Armbian TMDB-to-Kodi Server running at:`);
  console.log(` http://localhost:${PORT}`);
  console.log(` (Zero External Dependencies Required!)`);
  console.log(`=======================================================`);
});
