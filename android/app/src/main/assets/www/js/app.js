const state = {
  currentCategory: 'movie',
  currentView: 'discover',
  mediaItems: [],
  sources: [],
  selectedItem: null,
  currentSeason: 1,
  currentEpisode: 1
};

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_ORIGINAL_BASE = 'https://image.tmdb.org/t/p/original';

function getApiUrl(endpoint) {
  const base = localStorage.getItem('apiBaseUrl') || '';
  if (base) {
    const cleanBase = base.replace(/\/+$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    return cleanBase + cleanEndpoint;
  }
  return endpoint;
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  initDpadNavigation();
});

async function initApp() {
  await loadExploreData();
  await loadKodiConfig();
  await checkKodiStatus();
  setInterval(checkKodiStatus, 8000);
}

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.nav-menu a').forEach(el => el.classList.remove('active'));
  
  const targetNav = document.getElementById(`nav-${view}`);
  if (targetNav) targetNav.classList.add('active');

  document.getElementById('view-discover').style.display = view === 'discover' ? 'block' : 'none';
  document.getElementById('view-library').style.display = view === 'library' ? 'block' : 'none';
  document.getElementById('view-sources').style.display = view === 'sources' ? 'block' : 'none';
  document.getElementById('view-settings').style.display = view === 'settings' ? 'block' : 'none';

  if (view === 'library') loadLibraryData();
  if (view === 'sources') loadSourcesData();
}

function filterMediaType(type) {
  state.currentCategory = type;
  switchView('discover');
  document.querySelectorAll('.nav-menu a').forEach(el => el.classList.remove('active'));
  document.getElementById(type === 'movie' ? 'nav-movies' : 'nav-tv').classList.add('active');
  loadExploreData();
}

async function loadExploreData() {
  const grid = document.getElementById('mediaGrid');
  grid.innerHTML = '<div style="color:var(--text-muted); grid-column:1/-1;">⚡ 正在实时同步影视库...</div>';

  try {
    const res = await fetch(getApiUrl(`/api/tmdb/trending?type=${state.currentCategory}`));
    const data = await res.json();
    state.mediaItems = data.results || [];
    
    if (state.mediaItems.length > 0) {
      updateHeroBanner(state.mediaItems[0]);
    }
    
    renderMediaGrid(state.mediaItems, grid);
  } catch (err) {
    grid.innerHTML = `<div style="color:#ef4444; grid-column:1/-1;">加载失败: ${err.message}</div>`;
  }
}

function updateHeroBanner(item) {
  const banner = document.getElementById('heroBackdrop');
  const titleEl = document.getElementById('heroTitle');
  const overviewEl = document.getElementById('heroOverview');
  
  const title = item.title || item.name || '精选作品';
  let backdrop = item.backdropPath || item.backdrop_path || item.posterPath || item.poster_path || '';
  if (backdrop && backdrop.startsWith('/')) {
    backdrop = `${TMDB_ORIGINAL_BASE}${backdrop}`;
  }
  
  if (backdrop) {
    banner.style.backgroundImage = `url('${backdrop}')`;
  }
  titleEl.innerText = title;
  overviewEl.innerText = item.overview || '精彩好片尽在 Armbian TMDB2Kodi！';
}

function renderMediaGrid(items, container) {
  if (!items || items.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); grid-column:1/-1;">暂无匹配影视</div>';
    return;
  }

  container.innerHTML = items.map(item => {
    const title = item.title || item.name || '未知影视';
    let poster = item.posterPath || item.poster_path || '';
    if (poster && poster.startsWith('/')) {
      poster = `${TMDB_IMAGE_BASE}${poster}`;
    }
    if (!poster) {
      poster = 'https://via.placeholder.com/500x750?text=No+Poster';
    }
    const date = item.releaseDate || item.release_date || item.firstAirDate || item.first_air_date || '';
    const year = date ? date.split('-')[0] : '';
    const mediaType = item.mediaType || item.media_type || state.currentCategory;

    return `
      <div class="media-card" tabindex="0" onclick="openMediaDetail('${mediaType}', ${item.id})">
        <div class="poster-box">
          <img src="${poster}" alt="${title}" loading="lazy" onerror="this.src='https://via.placeholder.com/500x750?text=Poster+Unavailable'">
          <div class="card-overlay">
            <div class="play-btn-circle">▶</div>
          </div>
        </div>
        <div class="card-body">
          <div class="card-title" title="${title}">${title}</div>
          <div class="card-year">${mediaType.toUpperCase()} • ${year}</div>
        </div>
      </div>
    `;
  }).join('');
}

let searchTimer = null;
function handleSearch(event) {
  clearTimeout(searchTimer);
  const query = event.target.value.trim();
  if (!query) {
    loadExploreData();
    return;
  }

  searchTimer = setTimeout(async () => {
    switchView('discover');
    const grid = document.getElementById('mediaGrid');
    grid.innerHTML = '<div style="color:var(--text-muted); grid-column:1/-1;">🔍 搜索中...</div>';
    try {
      const res = await fetch(getApiUrl(`/api/tmdb/search?query=${encodeURIComponent(query)}`));
      const data = await res.json();
      renderMediaGrid(data.results || [], grid);
    } catch (err) {
      grid.innerHTML = `<div style="color:#ef4444; grid-column:1/-1;">搜索失败</div>`;
    }
  }, 350);
}

async function openMediaDetail(type, id) {
  const modal = document.getElementById('detailModal');
  const container = document.getElementById('modalDetailContent');
  modal.classList.add('active');
  container.innerHTML = '<div style="color:var(--text-muted); grid-column:1/-1; text-align:center; padding:2rem;">⏳ 获取详情并准备视频源...</div>';

  try {
    const res = await fetch(getApiUrl(`/api/tmdb/detail/${type}/${id}`));
    const detail = await res.json();
    state.selectedItem = { ...detail, media_type: type };

    renderDetailModal(detail, type);
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444;">加载详情失败: ${err.message}</div>`;
  }
}

function renderDetailModal(detail, type) {
  const container = document.getElementById('modalDetailContent');
  const title = detail.title || detail.name;
  const poster = detail.poster_path ? `${TMDB_IMAGE_BASE}${detail.poster_path}` : '';

  let seasonPickerHtml = '';
  if (type === 'tv' && detail.seasons) {
    seasonPickerHtml = `
      <div style="margin-bottom: 1rem; background: var(--bg-dark); padding: 0.8rem; border-radius: 8px;">
        <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:0.4rem;">选集控制器：</label>
        <div style="display:flex; gap:0.8rem;">
          <select id="seasonSelect" onchange="state.currentSeason = parseInt(this.value)" style="padding:0.4rem; background:var(--bg-card); color:white; border:1px solid var(--border-color); border-radius:6px;">
            ${detail.seasons.map(s => `<option value="${s.season_number}">第 ${s.season_number} 季</option>`).join('')}
          </select>
          <input type="number" id="episodeInput" value="1" min="1" style="width:70px; padding:0.4rem; background:var(--bg-card); color:white; border:1px solid var(--border-color); border-radius:6px;" onchange="state.currentEpisode = parseInt(this.value)">
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div>
      <img src="${poster}" style="width:100%; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
    </div>
    <div>
      <h2 style="font-size:1.8rem; font-weight:800; margin-bottom:0.5rem;">${title}</h2>
      <p style="color:var(--text-muted); font-size:0.95rem; line-height:1.6; margin-bottom:1.5rem;">${detail.overview || '暂无详细介绍'}</p>
      
      ${seasonPickerHtml}

      <button class="btn btn-kodi" tabindex="0" onclick="resolveAndPlayStream('${type}', ${detail.id})">
        🚀 抓取源替换并一键在 Kodi 播放
      </button>

      <div id="streamResults" style="margin-top:1.5rem;"></div>
    </div>
  `;
}

async function resolveAndPlayStream(type, tmdbId) {
  const div = document.getElementById('streamResults');
  div.innerHTML = '<div style="color:var(--text-muted);">⚡ 替换匹配 Cineby, FMovies, Cineplay 视频流...</div>';

  try {
    const res = await fetch(getApiUrl(`/api/resolve?type=${type}&tmdbId=${tmdbId}&season=${state.currentSeason}&episode=${state.currentEpisode}`));
    const data = await res.json();

    if (!data.streams || data.streams.length === 0) {
      div.innerHTML = '<div style="color:#ef4444;">未匹配到可用流</div>';
      return;
    }

    div.innerHTML = `
      <h4 style="margin-bottom:0.6rem; font-size:0.95rem;">🎯 转换解析可用源：</h4>
      <div style="display:flex; flex-direction:column; gap:0.5rem;">
        ${data.streams.map(st => `
          <div style="background:var(--bg-dark); padding:0.6rem 1rem; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
            <span><strong>${st.sourceName}</strong> (${st.quality})</span>
            <button class="btn btn-primary" tabindex="0" style="padding:0.3rem 0.7rem; font-size:0.8rem;" onclick="playStreamOnKodi('${encodeURIComponent(st.url)}')">
              📺 投屏到 Kodi
            </button>
          </div>
        `).join('')}
      </div>
    `;

    playStreamOnKodi(encodeURIComponent(data.streams[0].url));
  } catch (err) {
    div.innerHTML = `<div style="color:#ef4444;">解析失败: ${err.message}</div>`;
  }
}

async function playStreamOnKodi(encodedUrl) {
  const url = decodeURIComponent(encodedUrl);
  const title = state.selectedItem ? (state.selectedItem.title || state.selectedItem.name) : 'TMDB 视频';

  try {
    const res = await fetch(getApiUrl('/api/kodi/play'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, metadata: { title } })
    });
    const data = await res.json();
    if (data.success) {
      alert(`🎉 已成功通过 POST 指令推送到电视 Kodi 播放！\n影片: ${title}`);
    } else {
      alert(`❌ 推送 Kodi 失败: ${data.error}`);
    }
  } catch (e) {
    alert('通信错误');
  }
}

async function checkKodiStatus() {
  const dot = document.getElementById('kodiDot');
  const text = document.getElementById('kodiStatusText');
  try {
    const res = await fetch(getApiUrl('/api/kodi/status'));
    const data = await res.json();
    if (data.isPlaying) {
      dot.classList.add('online');
      text.innerText = 'Kodi 播放中';
    } else {
      dot.classList.remove('online');
      text.innerText = 'Kodi 在线待机';
    }
  } catch (e) {
    dot.classList.remove('online');
    text.innerText = 'Kodi 未连线';
  }
}

async function loadSourcesData() {
  const list = document.getElementById('sourceList');
  try {
    const res = await fetch(getApiUrl('/api/sources'));
    state.sources = await res.json();

    list.innerHTML = state.sources.map(src => `
      <div style="background:var(--bg-card); border:1px solid var(--border-color); padding:1rem; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h4 style="margin-bottom:0.2rem;">${src.name}</h4>
          <span style="font-size:0.85rem; color:var(--text-muted);">${src.url}</span>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <button class="btn btn-secondary" tabindex="0" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="deleteSource('${src.id}')">删除</button>
        </div>
      </div>
    `).join('');
  } catch (e) {}
}

function openAddSourceModal() {
  document.getElementById('sourceId').value = '';
  document.getElementById('sourceName').value = '';
  document.getElementById('sourceUrl').value = '';
  document.getElementById('sourceModal').classList.add('active');
}

async function saveSource(e) {
  e.preventDefault();
  const name = document.getElementById('sourceName').value;
  const url = document.getElementById('sourceUrl').value;

  await fetch(getApiUrl('/api/sources'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, url, enabled: true })
  });

  closeModal('sourceModal');
  loadSourcesData();
}

async function deleteSource(id) {
  if (!confirm('确定删除该源吗？')) return;
  await fetch(getApiUrl(`/api/sources/${id}`), { method: 'DELETE' });
  loadSourcesData();
}

async function loadLibraryData() {
  const grid = document.getElementById('libraryGrid');
  try {
    const res = await fetch(getApiUrl('/api/library'));
    const items = await res.json();
    renderMediaGrid(items, grid);
  } catch (e) {}
}

async function loadKodiConfig() {
  const savedBaseUrl = localStorage.getItem('apiBaseUrl') || '';
  const apiInput = document.getElementById('apiBaseUrl');
  if (apiInput) apiInput.value = savedBaseUrl;

  try {
    const res = await fetch(getApiUrl('/api/config'));
    const config = await res.json();
    if (config.kodi) {
      document.getElementById('kodiIp').value = config.kodi.ip || '';
      document.getElementById('kodiPort').value = config.kodi.port || 8080;
    }
  } catch (e) {}
}

async function saveKodiSettings(e) {
  e.preventDefault();
  const baseUrl = document.getElementById('apiBaseUrl').value.trim();
  localStorage.setItem('apiBaseUrl', baseUrl);

  const ip = document.getElementById('kodiIp').value;
  const port = parseInt(document.getElementById('kodiPort').value, 10);

  try {
    await fetch(getApiUrl('/api/kodi/settings'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port })
    });
    alert('✅ Bridge 后端与 Kodi 设置保存成功！');
  } catch (err) {
    alert('✅ 本地地址已保存！(后侧连通性提醒：' + err.message + ')');
  }
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

/* TV Remote Control Spatial Navigation */
function initDpadNavigation() {
  document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const focusables = Array.from(document.querySelectorAll('a, button, input, select, .media-card[tabindex="0"]'))
        .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && window.getComputedStyle(el).visibility !== 'hidden');

      if (focusables.length === 0) return;
      const current = document.activeElement;
      let index = focusables.indexOf(current);

      if (index === -1) {
        focusables[0].focus();
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        index = (index + 1) % focusables.length;
        focusables[index].focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        index = (index - 1 + focusables.length) % focusables.length;
        focusables[index].focus();
      }
    } else if (e.key === 'Enter' && document.activeElement) {
      document.activeElement.click();
    }
  });
}
