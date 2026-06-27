const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../config.json');

function getKodiConfig() {
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  return config.kodi || { ip: '192.168.1.100', port: 8080, username: '', password: '' };
}

class KodiService {
  async sendJsonRpc(method, params = {}, customConfig = null) {
    const kodiConfig = customConfig || getKodiConfig();
    const url = `http://${kodiConfig.ip}:${kodiConfig.port}/jsonrpc`;
    
    const payload = {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: Date.now()
    };

    const options = {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    };

    if (kodiConfig.username && kodiConfig.password) {
      options.auth = {
        username: kodiConfig.username,
        password: kodiConfig.password
      };
    }

    try {
      const response = await axios.post(url, payload, options);
      return response.data;
    } catch (error) {
      console.error(`Kodi JSON-RPC POST Error (${method}) -> ${url}:`, error.message);
      throw new Error(`无法连接至电视端 Kodi (${kodiConfig.ip}:${kodiConfig.port})，请检查网络与 Kodi HTTP 遥控设置。`);
    }
  }

  /**
   * Play a video stream on Kodi via JSON-RPC POST
   */
  async playUrl(mediaUrl, metadata = {}) {
    const title = metadata.title || 'TMDB 视频流';
    const subtitle = metadata.subtitle || 'Armbian 播放桥接';

    // 1. Show OSD Notification on Kodi screen
    try {
      await this.sendJsonRpc('GUI.ShowNotification', {
        title: 'Armbian 投屏播放',
        message: title,
        image: metadata.poster || 'info',
        displaytime: 4000
      });
    } catch (e) {
      // Ignore notification failure if player opens
    }

    // 2. Send Player.Open POST request
    return await this.sendJsonRpc('Player.Open', {
      item: {
        file: mediaUrl
      }
    });
  }

  /**
   * Get Active Players (Video / Audio / Picture)
   */
  async getActivePlayers() {
    const res = await this.sendJsonRpc('Player.GetActivePlayers');
    return res.result || [];
  }

  /**
   * Control Player (playPause, stop, next, previous)
   */
  async control(action, value = null) {
    const activePlayers = await this.getActivePlayers();
    const playerId = activePlayers.length > 0 ? activePlayers[0].playerid : 1;

    switch (action) {
      case 'playPause':
        return await this.sendJsonRpc('Player.PlayPause', { playerid: playerId });
      case 'stop':
        return await this.sendJsonRpc('Player.Stop', { playerid: playerId });
      case 'setVolume':
        return await this.sendJsonRpc('Application.SetVolume', { volume: parseInt(value, 10) });
      case 'seek':
        // value is percentage (0 - 100)
        return await this.sendJsonRpc('Player.Seek', { playerid: playerId, value: parseFloat(value) });
      default:
        throw new Error(`Unsupported Kodi control action: ${action}`);
    }
  }

  /**
   * Get current player properties (time, totaltime, speed, percentage, volume)
   */
  async getStatus() {
    try {
      const activePlayers = await this.getActivePlayers();
      if (activePlayers.length === 0) {
        return { isPlaying: false, activePlayer: null };
      }

      const playerId = activePlayers[0].playerid;
      const playerProps = await this.sendJsonRpc('Player.GetProperties', {
        playerid: playerId,
        properties: ['time', 'totaltime', 'percentage', 'speed']
      });

      const appProps = await this.sendJsonRpc('Application.GetProperties', {
        properties: ['volume', 'muted']
      });

      return {
        isPlaying: true,
        playerId: playerId,
        type: activePlayers[0].type,
        player: playerProps.result,
        application: appProps.result
      };
    } catch (e) {
      return { isPlaying: false, error: e.message };
    }
  }

  /**
   * Update Kodi connection settings in config.json
   */
  updateSettings(settings) {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    config.kodi = {
      ...config.kodi,
      ...settings
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return config.kodi;
  }
}

module.exports = new KodiService();
