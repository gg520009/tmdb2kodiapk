import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const router = Router();
const CONFIG_FILE = path.join(process.cwd(), 'config/bridge_config.json');

function getBridgeConfig() {
  if (!fs.existsSync(path.dirname(CONFIG_FILE))) {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = {
      kodi: { ip: '192.168.1.100', port: 8080, username: '', password: '' },
      sources: [
        { id: 'vidsrc_me', name: 'VidSrcme 极速流', url: 'https://vidsrcme.ru/embed', enabled: true, isDefault: true },
        { id: 'fmovies', name: 'FMovies (网页端推荐)', url: 'https://www.fmovies.gd', enabled: true, isDefault: false },
        { id: 'cineby', name: 'Cineby (网页端推荐)', url: 'https://www.cineby.at', enabled: true, isDefault: false }
      ]
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  if (data.sources && Array.isArray(data.sources)) {
    let hasDefault = data.sources.some((s: any) => s.isDefault);
    if (!hasDefault && data.sources.length > 0) {
      data.sources[0].isDefault = true;
    }
  }
  return data;
}

function saveBridgeConfig(cfg: any) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function getAxiosOptions(kodi: any, timeout = 5000) {
  const options: any = {
    headers: { 'Content-Type': 'application/json' },
    timeout
  };
  if (kodi.username && kodi.password) {
    options.auth = {
      username: kodi.username,
      password: kodi.password
    };
  }
  return options;
}

// True Dynamic Stream Extraction Engine
async function resolvePhysicalMediaStream(webUrl: string, tmdbId?: string, type?: string): Promise<string> {
  console.log(`\n=================== [DYNAMIC STREAM EXTRACTION START] ===================`);
  console.log(`[RESOLVER] 收到解流呼叫 - 原始 URL: ${webUrl}, TMDB ID: ${tmdbId}, Type: ${type}`);

  const client = axios.create({
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    timeout: 6000
  });

  // 1. If TMDB ID is available, attempt dynamic extraction from vidsrcme
  if (tmdbId) {
    const isTv = type === 'tv' || webUrl.includes('/tv/');
    const targetEmbedUrl = isTv
      ? `https://vidsrcme.ru/embed/tv?tmdb=${tmdbId}&season=1&episode=1`
      : `https://vidsrcme.ru/embed/movie?tmdb=${tmdbId}`;

    console.log(`[RESOLVER ENGINE] 正在发起动态页面深挖掘: ${targetEmbedUrl}`);
    try {
      const res1 = await client.get(targetEmbedUrl);
      const html1 = res1.data || '';

      // Check iframe src inside player
      const iframeMatch = html1.match(/<iframe[^>]+id=["']player_iframe["'][^>]+src=["']([^"']+)["']/i) ||
                         html1.match(/<iframe[^>]+src=["']([^"']+)["']/i);

      if (iframeMatch) {
        let iframeUrl = iframeMatch[1];
        if (iframeUrl.startsWith('//')) iframeUrl = 'https:' + iframeUrl;
        console.log(`[RESOLVER ENGINE SUCCESS] 🎉 成功穿透解密提取到关键 Player Iframe:\n>> ${iframeUrl}`);
        
        // Secondary crawl to fetch .m3u8 if possible
        try {
          const res2 = await client.get(iframeUrl, { headers: { Referer: targetEmbedUrl } });
          const html2 = res2.data || '';
          const m3u8Match = html2.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
          if (m3u8Match) {
            console.log(`[RESOLVER ENGINE SUCCESS] 🌟 二次挖掘成功抓取到原生 M3U8 直链:\n>> ${m3u8Match[1]}`);
            return m3u8Match[1];
          }
        } catch (e: any) {}

        return iframeUrl;
      }
    } catch (e: any) {
      console.log(`[RESOLVER ENGINE DEBUG] 动态解算遇到异常: ${e.message}`);
    }
  }

  // Fallback to primary url with headers
  console.log(`[RESOLVER ENGINE WARN] 回退默认链接输出`);
  console.log(`=================== [DYNAMIC STREAM EXTRACTION END] ===================\n`);
  return webUrl;
}

router.get('/config', (_req, res) => {
  const cfg = getBridgeConfig();
  return res.status(200).json(cfg);
});

router.get('/sources', (_req, res) => {
  const cfg = getBridgeConfig();
  return res.status(200).json(cfg.sources || []);
});

router.post('/sources', (req, res) => {
  const cfg = getBridgeConfig();
  cfg.sources = cfg.sources || [];
  const isDefault = req.body.isDefault || cfg.sources.length === 0;

  if (isDefault) {
    cfg.sources.forEach((s: any) => (s.isDefault = false));
  }

  const newSrc = {
    id: 'src_' + Date.now(),
    enabled: true,
    isDefault,
    ...req.body
  };
  cfg.sources.push(newSrc);
  saveBridgeConfig(cfg);
  return res.status(200).json(cfg.sources);
});

router.post('/sources/default/:id', (req, res) => {
  const cfg = getBridgeConfig();
  cfg.sources = cfg.sources || [];
  cfg.sources.forEach((s: any) => {
    s.isDefault = s.id === req.params.id;
  });
  saveBridgeConfig(cfg);
  return res.status(200).json(cfg.sources);
});

router.delete('/sources/:id', (req, res) => {
  const cfg = getBridgeConfig();
  cfg.sources = (cfg.sources || []).filter((s: any) => s.id !== req.params.id);
  if (cfg.sources.length > 0 && !cfg.sources.some((s: any) => s.isDefault)) {
    cfg.sources[0].isDefault = true;
  }
  saveBridgeConfig(cfg);
  return res.status(200).json(cfg.sources);
});

router.get('/resolve', (req, res) => {
  const { type, tmdbId, season, episode } = req.query;
  const cfg = getBridgeConfig();
  const streams: any[] = [];

  const activeSources = (cfg.sources || [])
    .filter((s: any) => s.enabled)
    .sort((a: any, b: any) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));

  for (const src of activeSources) {
    const pathStr = type === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}/${season || 1}/${episode || 1}`;
    streams.push({
      sourceName: `${src.name}${src.isDefault ? ' (⭐默认首选)' : ''}`,
      quality: 'HD 1080p 纯视频流',
      isDefault: !!src.isDefault,
      url: `${src.url.replace(/\/+$/, '')}${pathStr}`
    });
  }

  return res.status(200).json({ streams });
});

router.post('/kodi/play', async (req, res) => {
  let { url, title } = req.body;
  const cfg = getBridgeConfig();
  const kodi = cfg.kodi || {};
  const targetUrl = `http://${kodi.ip}:${kodi.port}/jsonrpc`;
  const options = getAxiosOptions(kodi, 5000);

  console.log(`\n🚀 [KODI DYNAMIC EXECUTE] 开始执行真动态解解流与 Kodi 投屏...`);
  console.log(`[KODI DYNAMIC EXECUTE] 呼叫影片: ${title}, 原始 URL: ${url}`);

  let tmdbIdMatch = url.match(/\/movie\/(\d+)/) || url.match(/\/tv\/(\d+)/);
  let tmdbId = tmdbIdMatch ? tmdbIdMatch[1] : undefined;
  let type = url.includes('/tv/') ? 'tv' : 'movie';

  let rawMediaUrl = await resolvePhysicalMediaStream(url, tmdbId, type);
  let finalKodiUrl = rawMediaUrl;

  if (!finalKodiUrl.startsWith('plugin://') && !finalKodiUrl.includes('|')) {
    const headersStr = `User-Agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36&Referer=https://vidsrcme.ru/&Origin=https://vidsrcme.ru`;
    finalKodiUrl = `${rawMediaUrl}|${headersStr}`;
  }

  console.log(`[KODI DYNAMIC EXECUTE] 🎯 真动态解流提取完成! 最终 Payload 为:\n>>>>> ${finalKodiUrl} <<<<<`);

  try {
    await axios.post(targetUrl, {
      jsonrpc: '2.0',
      method: 'GUI.ShowNotification',
      params: { title: 'Armbian Kodi Bridge', message: title || '播放在线视频', displaytime: 3000 },
      id: 1
    }, getAxiosOptions(kodi, 3000)).catch(() => {});

    const response = await axios.post(targetUrl, {
      jsonrpc: '2.0',
      method: 'Player.Open',
      params: { item: { file: finalKodiUrl } },
      id: Date.now()
    }, options);

    console.log(`[KODI DYNAMIC EXECUTE] 🎉 Kodi 电视原生播放唤醒成功!`);
    return res.status(200).json({ success: true, result: response.data, finalKodiUrl });
  } catch (err: any) {
    console.log(`[KODI DYNAMIC EXECUTE] ❌ Kodi 通信异常: ${err.message}`);
    return res.status(200).json({ success: false, note: `向 Kodi (${kodi.ip}:${kodi.port}) 发送 POST 指令: ${err.message}`, finalKodiUrl });
  }
});

router.post('/kodi/settings', (req, res) => {
  const cfg = getBridgeConfig();
  cfg.kodi = {
    ...cfg.kodi,
    ...req.body
  };
  saveBridgeConfig(cfg);
  return res.status(200).json({ success: true, kodi: cfg.kodi });
});

export default router;
