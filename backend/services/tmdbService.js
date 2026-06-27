const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../data/local_db.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

// Initial DB setup
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ library: [], history: [], cache: {} }, null, 2));
}

function readDB() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return { library: [], history: [], cache: {} };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

class TmdbService {
  constructor() {
    this.baseUrl = 'https://api.themoviedb.org/3';
  }

  getConfig() {
    const configPath = path.join(__dirname, '../config.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  getApiKey() {
    const config = this.getConfig();
    return config.tmdb.apiKey || '3fd2be6f0cd70463863140b953280d3a';
  }

  getLanguage() {
    const config = this.getConfig();
    return config.tmdb.language || 'zh-CN';
  }

  async fetchFromTmdb(endpoint, params = {}) {
    const apiKey = this.getApiKey();
    const language = this.getLanguage();
    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        params: {
          api_key: apiKey,
          language: language,
          ...params
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error(`TMDB API Error (${endpoint}):`, error.message);
      throw error;
    }
  }

  async getTrending(type = 'movie', timeWindow = 'day', page = 1) {
    return await this.fetchFromTmdb(`/trending/${type}/${timeWindow}`, { page });
  }

  async getPopular(type = 'movie', page = 1) {
    return await this.fetchFromTmdb(`/${type}/popular`, { page });
  }

  async search(query, type = 'multi', page = 1) {
    return await this.fetchFromTmdb(`/search/${type}`, { query, page });
  }

  async getDetail(type, id) {
    const db = readDB();
    const cacheKey = `${type}_${id}`;
    
    // Fetch fresh detail with external IDs (IMDB ID) and Append to response
    const detail = await this.fetchFromTmdb(`/${type}/${id}`, {
      append_to_response: 'external_ids,credits,videos'
    });

    // Save to local cache / replicate to local
    db.cache[cacheKey] = {
      ...detail,
      updatedAt: new Date().toISOString()
    };
    writeDB(db);

    return detail;
  }

  async getTvSeason(id, seasonNumber) {
    return await this.fetchFromTmdb(`/tv/${id}/season/${seasonNumber}`);
  }

  // Local Replication & Library Management
  getLibrary() {
    const db = readDB();
    return db.library;
  }

  addToLibrary(item) {
    const db = readDB();
    const exists = db.library.find(i => i.id === item.id && i.media_type === item.media_type);
    if (!exists) {
      db.library.unshift({
        ...item,
        addedAt: new Date().toISOString()
      });
      writeDB(db);
    }
    return db.library;
  }

  removeFromLibrary(id, media_type) {
    const db = readDB();
    db.library = db.library.filter(i => !(i.id == id && i.media_type === media_type));
    writeDB(db);
    return db.library;
  }

  addWatchHistory(item) {
    const db = readDB();
    db.history = db.history.filter(h => !(h.id === item.id && h.media_type === item.media_type));
    db.history.unshift({
      ...item,
      watchedAt: new Date().toISOString()
    });
    // keep max 50 items
    if (db.history.length > 50) db.history.pop();
    writeDB(db);
    return db.history;
  }

  getWatchHistory() {
    const db = readDB();
    return db.history;
  }
}

module.exports = new TmdbService();
