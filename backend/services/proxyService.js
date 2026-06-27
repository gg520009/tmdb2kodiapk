const axios = require('axios');

class ProxyService {
  async proxyStream(req, res) {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).send('Missing "url" parameter for streaming proxy.');
    }

    const referer = req.query.referer || targetUrl;
    const userAgent = req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    try {
      const response = await axios({
        method: 'get',
        url: targetUrl,
        headers: {
          'User-Agent': userAgent,
          'Referer': referer,
          'Accept': '*/*'
        },
        responseType: 'stream',
        timeout: 15000
      });

      // Copy key headers to response
      if (response.headers['content-type']) {
        res.setHeader('Content-Type', response.headers['content-type']);
      }
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }
      res.setHeader('Access-Control-Allow-Origin', '*');

      response.data.pipe(res);
    } catch (error) {
      console.error(`Stream Proxy Error for (${targetUrl}):`, error.message);
      res.status(500).send(`Proxy failed: ${error.message}`);
    }
  }
}

module.exports = new ProxyService();
