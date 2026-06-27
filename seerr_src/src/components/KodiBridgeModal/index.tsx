import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface KodiBridgeDetail {
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  title: string;
}

const KodiBridgeModal: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [detail, setDetail] = useState<KodiBridgeDetail | null>(null);
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [statusText, setStatusText] = useState('');

  const [kodiIp, setKodiIp] = useState('192.168.1.100');
  const [kodiPort, setKodiPort] = useState(8080);
  const [kodiUsername, setKodiUsername] = useState('');
  const [kodiPassword, setKodiPassword] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchKodiSettings();

    const handleOpen = (e: any) => {
      try {
        if (e && e.detail) {
          setDetail(e.detail);
          setIsOpen(true);
          resolveStreams(e.detail.mediaType, e.detail.tmdbId, 1, 1);
        }
      } catch (err) {
        console.error('Error opening Kodi bridge modal', err);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('openKodiBridge', handleOpen);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('openKodiBridge', handleOpen);
      }
    };
  }, []);

  const fetchKodiSettings = async () => {
    try {
      const res = await axios.get('/api/v1/bridge/config');
      if (res.data && res.data.kodi) {
        setKodiIp(res.data.kodi.ip || '192.168.1.100');
        setKodiPort(res.data.kodi.port || 8080);
        setKodiUsername(res.data.kodi.username || '');
        setKodiPassword(res.data.kodi.password || '');
      }
    } catch (e) {}
  };

  const saveKodiSettings = async () => {
    try {
      await axios.post('/api/v1/bridge/kodi/settings', {
        ip: kodiIp,
        port: kodiPort,
        username: kodiUsername,
        password: kodiPassword
      });
      alert('🎉 Kodi 电视连接与鉴权配置保存成功！');
      setShowSettings(false);
    } catch (err: any) {
      alert(`保存失败: ${err.message}`);
    }
  };

  const resolveStreams = async (mediaType: string, tmdbId: number, s: number, ep: number) => {
    setLoading(true);
    setStatusText('⚡ 正在抓取第三方极速视频源...');
    try {
      const res = await axios.get(`/api/v1/bridge/resolve?type=${mediaType}&tmdbId=${tmdbId}&season=${s}&episode=${ep}`);
      setStreams(res.data.streams || []);
    } catch (err: any) {
      setStatusText(`解析源发生错误: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const playOnKodi = async (streamUrl: string) => {
    try {
      const res = await axios.post('/api/v1/bridge/kodi/play', {
        url: streamUrl,
        title: detail?.title || 'TMDB Video'
      });
      if (res.data.success) {
        alert(`🎉 已成功通过 POST 请求推送到电视端 Kodi 全屏播放！\n影片: ${detail?.title}`);
      } else {
        alert(`推送 Kodi 状态: ${res.data.note || res.data.error || '指令已发出'}`);
      }
    } catch (err: any) {
      alert(`通信提醒: ${err.message}`);
    }
  };

  if (!mounted || !isOpen || !detail) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden p-6 text-white space-y-4">
        <div className="flex justify-between items-start border-b border-gray-800 pb-3">
          <div>
            <h3 className="text-lg font-bold text-white">📺 投屏至 Kodi - {detail.title}</h3>
            <p className="text-xs text-gray-400">匹配第三方极速视频源并推送到电视</p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white text-xl font-bold px-2"
          >
            ✕
          </button>
        </div>

        {/* Kodi Settings Toggle */}
        <div className="bg-gray-800/90 p-3 rounded-lg border border-gray-700">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-gray-200">
              ⚙️ 电视 Kodi 设置 (当前 IP: <strong className="text-cyan-400">{kodiIp}</strong>:{kodiPort})
            </span>
            <button
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              onClick={() => setShowSettings(!showSettings)}
            >
              {showSettings ? '收起设置' : '修改 IP/端口/账号密码'}
            </button>
          </div>

          {showSettings && (
            <div className="mt-3 pt-3 border-t border-gray-700 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 block mb-1">电视 Kodi IP 地址</label>
                  <input
                    type="text"
                    value={kodiIp}
                    onChange={(e) => setKodiIp(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">HTTP 端口</label>
                  <input
                    type="number"
                    value={kodiPort}
                    onChange={(e) => setKodiPort(parseInt(e.target.value, 10))}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">HTTP 账号</label>
                  <input
                    type="text"
                    value={kodiUsername}
                    onChange={(e) => setKodiUsername(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">HTTP 密码</label>
                  <input
                    type="password"
                    value={kodiPassword}
                    onChange={(e) => setKodiPassword(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  className="bg-indigo-600 hover:bg-indigo-500 text-xs px-3 py-1.5 rounded text-white font-medium"
                  onClick={saveKodiSettings}
                >
                  💾 保存完整参数
                </button>
              </div>
            </div>
          )}
        </div>

        {detail.mediaType === 'tv' && (
          <div className="flex gap-4 items-center bg-gray-800 p-3 rounded-md text-xs">
            <span>选集控制器：</span>
            <span>第</span>
            <input
              type="number"
              value={season}
              min={1}
              className="w-12 bg-gray-900 border border-gray-700 rounded p-1 text-white text-center"
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setSeason(val);
                resolveStreams('tv', detail.tmdbId, val, episode);
              }}
            />
            <span>季 ，第</span>
            <input
              type="number"
              value={episode}
              min={1}
              className="w-12 bg-gray-900 border border-gray-700 rounded p-1 text-white text-center"
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setEpisode(val);
                resolveStreams('tv', detail.tmdbId, season, val);
              }}
            />
            <span>集</span>
          </div>
        )}

        {loading && <div className="text-gray-400 text-xs animate-pulse py-2">{statusText}</div>}

        {!loading && streams.length === 0 && (
          <div className="text-red-400 text-xs py-2">未匹配到可用解算视频流</div>
        )}

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {streams.map((st, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center bg-gray-800/80 p-3 rounded-lg border border-gray-700/50"
            >
              <div>
                <div className="font-semibold text-sm text-white">{st.sourceName}</div>
                <div className="text-xs text-gray-400 truncate max-w-xs">{st.url}</div>
              </div>
              <button
                className="bg-cyan-600 hover:bg-cyan-500 text-xs px-3 py-1.5 rounded text-white font-medium"
                onClick={() => playOnKodi(st.url)}
              >
                ▶ 推送播放
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KodiBridgeModal;
