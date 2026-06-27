import React, { useState, useEffect } from 'react';
import Button from '@app/components/Common/Button';
import PageTitle from '@app/components/Common/PageTitle';
import axios from 'axios';

interface SourceItem {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  isDefault: boolean;
}

const SettingsKodi: React.FC = () => {
  // Kodi Settings State
  const [kodiIp, setKodiIp] = useState('192.168.1.100');
  const [kodiPort, setKodiPort] = useState(8080);
  const [kodiUsername, setKodiUsername] = useState('');
  const [kodiPassword, setKodiPassword] = useState('');
  const [savingKodi, setSavingKodi] = useState(false);

  // Video Sources State
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [newSrcName, setNewSrcName] = useState('');
  const [newSrcUrl, setNewSrcUrl] = useState('');
  const [addingSrc, setAddingSrc] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await axios.get('/api/v1/bridge/config');
      if (res.data) {
        if (res.data.kodi) {
          setKodiIp(res.data.kodi.ip || '192.168.1.100');
          setKodiPort(res.data.kodi.port || 8080);
          setKodiUsername(res.data.kodi.username || '');
          setKodiPassword(res.data.kodi.password || '');
        }
        if (res.data.sources) {
          setSources(res.data.sources);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch config', err);
    }
  };

  const handleSaveKodi = async () => {
    setSavingKodi(true);
    try {
      await axios.post('/api/v1/bridge/kodi/settings', {
        ip: kodiIp,
        port: kodiPort,
        username: kodiUsername,
        password: kodiPassword,
      });
      alert('🎉 Kodi 电视连接与鉴权配置保存成功！');
    } catch (err: any) {
      alert(`保存失败: ${err.message}`);
    } finally {
      setSavingKodi(false);
    }
  };

  const handleAddSource = async () => {
    if (!newSrcName.trim() || !newSrcUrl.trim()) {
      alert('请填写完整的资源名称与资源网址！');
      return;
    }
    setAddingSrc(true);
    try {
      const res = await axios.post('/api/v1/bridge/sources', {
        name: newSrcName.trim(),
        url: newSrcUrl.trim(),
      });
      setSources(res.data);
      setNewSrcName('');
      setNewSrcUrl('');
      alert('🎉 新视频资源网址添加成功！');
    } catch (err: any) {
      alert(`添加失败: ${err.message}`);
    } finally {
      setAddingSrc(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const res = await axios.post(`/api/v1/bridge/sources/default/${id}`);
      setSources(res.data);
    } catch (err: any) {
      alert(`设置默认失败: ${err.message}`);
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm('确定要删除此视频资源网址吗？')) return;
    try {
      const res = await axios.delete(`/api/v1/bridge/sources/${id}`);
      setSources(res.data);
    } catch (err: any) {
      alert(`删除失败: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <PageTitle title="Kodi & 视频资源设置" />

      {/* 1. Kodi Settings */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-lg">
        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          📺 1. 电视 Kodi 远程控制配置
        </h3>
        <p className="text-sm text-gray-400 mb-6">
          设置电视端 Kodi 的 HTTP 远程控制 IP、端口以及安全验证账号密码。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              电视 Kodi IP 地址
            </label>
            <input
              type="text"
              value={kodiIp}
              onChange={(e) => setKodiIp(e.target.value)}
              placeholder="例如: 192.168.1.108"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              HTTP 端口
            </label>
            <input
              type="number"
              value={kodiPort}
              onChange={(e) => setKodiPort(parseInt(e.target.value, 10))}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              HTTP 账号 (未设置留空)
            </label>
            <input
              type="text"
              value={kodiUsername}
              onChange={(e) => setKodiUsername(e.target.value)}
              placeholder="可选，默认留空"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              HTTP 密码 (未设置留空)
            </label>
            <input
              type="password"
              value={kodiPassword}
              onChange={(e) => setKodiPassword(e.target.value)}
              placeholder="可选，默认留空"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            buttonType="primary"
            className="bg-indigo-600 hover:bg-indigo-500 px-6"
            onClick={handleSaveKodi}
          >
            {savingKodi ? '保存中...' : '💾 保存 Kodi 设置'}
          </Button>
        </div>
      </div>

      {/* 2. Video Sources Settings */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-lg">
        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          🌐 2. 视频资源网址管理 (动态解析替换源)
        </h3>
        <p className="text-sm text-gray-400 mb-6">
          自动把 TMDB ID 匹配替换到这些网址抓取视频流。支持任意新增、删除及【设为默认/首选源】！
        </p>

        {/* Sources List */}
        <div className="space-y-3 mb-8">
          {sources.map((src) => (
            <div
              key={src.id}
              className={`flex items-center justify-between p-4 rounded-lg border transition ${
                src.isDefault
                  ? 'bg-amber-950/30 border-amber-500/60 shadow-md'
                  : 'bg-gray-900/80 border-gray-700/60'
              }`}
            >
              <div>
                <div className="font-bold text-white flex items-center gap-2">
                  <span>{src.name}</span>
                  {src.isDefault ? (
                    <span className="text-xs bg-amber-500 text-black font-semibold px-2 py-0.5 rounded shadow">
                      ⭐ 默认首选源
                    </span>
                  ) : (
                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded border border-gray-700">
                      备用源
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-400 font-mono mt-0.5">
                  {src.url}
                </div>
              </div>
              <div className="flex gap-2">
                {!src.isDefault && (
                  <Button
                    buttonType="warning"
                    buttonSize="sm"
                    className="bg-amber-600 hover:bg-amber-500 text-black font-medium"
                    onClick={() => handleSetDefault(src.id)}
                  >
                    ⭐ 设为默认
                  </Button>
                )}
                <Button
                  buttonType="danger"
                  buttonSize="sm"
                  onClick={() => handleDeleteSource(src.id)}
                >
                  🗑️ 删除
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Add New Source */}
        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/40">
          <h4 className="text-sm font-bold text-gray-200 mb-3">
            ➕ 新增第三方视频资源网址
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">
                资源站点名称
              </label>
              <input
                type="text"
                value={newSrcName}
                onChange={(e) => setNewSrcName(e.target.value)}
                placeholder="例如: Custom FMovies"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">
                视频资源 Base 网址
              </label>
              <input
                type="text"
                value={newSrcUrl}
                onChange={(e) => setNewSrcUrl(e.target.value)}
                placeholder="例如: https://www.fmovies.gd"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <Button
                buttonType="primary"
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-sm font-medium"
                onClick={handleAddSource}
              >
                {addingSrc ? '添加中...' : '确认新增'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsKodi;
