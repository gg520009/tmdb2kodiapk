const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const CONFIG_FILE = path.join(__dirname, '../config.json');

function getConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

class SourceService {
  getSources() {
    const config = getConfig();
    return config.sources || [];
  }

  addSource(sourceData) {
    const config = getConfig();
    const newSource = {
      id: sourceData.id || 'src_' + Date.now(),
      name: sourceData.name || 'Custom Source',
      url: sourceData.url.replace(/\/+$/, ''),
      enabled: sourceData.enabled !== false,
      type: sourceData.type || 'embed_provider'
    };
    config.sources = config.sources || [];
    config.sources.push(newSource);
    saveConfig(config);
    return config.sources;
  }

  updateSource(id, updateData) {
    const config = getConfig();
    config.sources = (config.sources || []).map(src => {
      if (src.id === id) {
        return { ...src, ...updateData };
      }
      return src;
    });
    saveConfig(config);
    return config.sources;
  }

  deleteSource(id) {
    const config = getConfig();
    config.sources = (config.sources || []).filter(src => src.id !== id);
    saveConfig(config);
    return config.sources;
  }

  /**
   * Resolve media stream sources for a given movie or TV show.
   * Replaces TMDB ID / IMDB ID into target source URLs and extracts stream links.
   */
  async resolveStreams(mediaType, tmdbId, imdbId, season = 1, episode = 1) {
    const sources = this.getSources().filter(s => s.enabled);
    const results = [];

    for (const source of sources) {
      try {
        const streamInfo = await this.extractFromSource(source, mediaType, tmdbId, imdbId, season, episode);
        if (streamInfo && streamInfo.length > 0) {
          results.push(...streamInfo);
        }
      } catch (err) {
        console.error(`Error extracting from source ${source.name} (${source.url}):`, err.message);
      }
    }

    // Fallback/Standard Public Embed Resolvers if custom ones return embedded player URLs
    const standardResolvers = [
      { name: 'VidSrc Me', getUrl: (t, id, s, e) => t === 'movie' ? `https://vidsrc.me/embed/movie?tmdb=${id}` : `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}` },
      { name: 'AutoEmbed', getUrl: (t, id, s, e) => t === 'movie' ? `https://player.autoembed.cc/embed/movie/${id}` : `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}` },
      { name: 'Embed.su', getUrl: (t, id, s, e) => t === 'movie' ? `https://embed.su/embed/movie/${id}` : `https://embed.su/embed/tv/${id}/${s}/${e}` }
    ];

    for (const res of standardResolvers) {
      const embedUrl = res.getUrl(mediaType, tmdbId, season, episode);
      results.push({
        sourceName: res.name,
        type: 'embed',
        quality: 'Auto / 1080p',
        url: embedUrl,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Referer': embedUrl
        }
      });
    }

    return results;
  }

  async extractFromSource(source, mediaType, tmdbId, imdbId, season, episode) {
    const baseUrl = source.url.replace(/\/+$/, '');
    const streams = [];

    // Construct common URL formats used by Cineby, FMovies, Cineplay
    // Format 1: /movie/{tmdb_id} or /tv/{tmdb_id}/{season}/{episode}
    // Format 2: /watch-movie/{tmdb_id} or /watch-tv/{tmdb_id}
    let targetPath = '';
    if (mediaType === 'movie') {
      targetPath = `/movie/${tmdbId}`;
    } else {
      targetPath = `/tv/${tmdbId}/${season}/${episode}`;
    }

    const fullUrl = `${baseUrl}${targetPath}`;

    // Direct embed object for Kodi consumption
    streams.push({
      sourceId: source.id,
      sourceName: source.name,
      type: 'direct_source',
      quality: 'HD 1080p',
      pageUrl: fullUrl,
      url: fullUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': baseUrl
      }
    });

    return streams;
  }
}

module.exports = new SourceService();
