import os
import json
import urllib.request
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8888
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, 'config.json')
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, '../frontend'))

def get_config():
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_config(cfg):
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)

def fetch_json(url_str, timeout=6):
    req = urllib.request.Request(url_str, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8'))

class BridgeRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path.startswith('/api/'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()

            try:
                cfg = get_config()
                jelly_base = cfg.get('jellyseerrUrl', 'http://pan.local:5055').rstrip('/')

                if path == '/api/jellyseerr/test':
                    try:
                        data = fetch_json(f"{jelly_base}/api/v1/status", timeout=5)
                        self.wfile.write(json.dumps({
                            "success": True,
                            "jellyseerr_url": jelly_base,
                            "version": data.get("version", "unknown"),
                            "message": "🎉 成功连通并成功调用 Jellyseerr REST API！"
                        }).encode('utf-8'))
                    except Exception as e:
                        self.wfile.write(json.dumps({
                            "success": False,
                            "jellyseerr_url": jelly_base,
                            "error": str(e)
                        }).encode('utf-8'))
                    return

                if path == '/api/tmdb/trending':
                    mtype = query.get('type', ['movie'])[0]
                    jelly_url = f"{jelly_base}/api/v1/discover/{'movies' if mtype == 'movie' else 'tv'}"
                    try:
                        data = fetch_json(jelly_url, timeout=6)
                        if data.get('results'):
                            data['source_from'] = f'Jellyseerr API ({jelly_base})'
                            self.wfile.write(json.dumps(data).encode('utf-8'))
                            return
                    except Exception as e:
                        print(f"[Jellyseerr Fetch Error]: {e}")

                elif path == '/api/tmdb/search':
                    q = query.get('query', [''])[0].strip()
                    jelly_url = f"{jelly_base}/api/v1/search?query={urllib.parse.quote(q)}"
                    try:
                        data = fetch_json(jelly_url, timeout=6)
                        if data.get('results'):
                            data['source_from'] = f'Jellyseerr API ({jelly_base})'
                            self.wfile.write(json.dumps(data).encode('utf-8'))
                            return
                    except Exception as e:
                        print(f"[Jellyseerr Search Error]: {e}")

                elif path.startswith('/api/tmdb/detail/'):
                    parts = path.split('/')
                    mtype, mid = parts[4], parts[5]
                    jelly_url = f"{jelly_base}/api/v1/{mtype}/{mid}"
                    try:
                        data = fetch_json(jelly_url, timeout=6)
                        self.wfile.write(json.dumps(data).encode('utf-8'))
                        return
                    except Exception:
                        pass

                elif path == '/api/sources':
                    self.wfile.write(json.dumps(cfg.get('sources', [])).encode('utf-8'))
                    return

                elif path == '/api/resolve':
                    mtype = query.get('type', ['movie'])[0]
                    tmdb_id = query.get('tmdbId', [''])[0]
                    season = query.get('season', ['1'])[0]
                    episode = query.get('episode', ['1'])[0]

                    streams = []
                    for src in cfg.get('sources', []):
                        if src.get('enabled', True):
                            path_str = f"/movie/{tmdb_id}" if mtype == 'movie' else f"/tv/{tmdb_id}/{season}/{episode}"
                            streams.append({
                                'sourceName': src['name'],
                                'quality': 'HD 1080p',
                                'url': f"{src['url'].rstrip('/')}{path_str}"
                            })

                    if mtype == 'movie':
                        streams.append({'sourceName': 'VidSrc Embed', 'quality': '1080p', 'url': f"https://vidsrc.me/embed/movie?tmdb={tmdb_id}"})
                        streams.append({'sourceName': 'AutoEmbed Provider', 'quality': '1080p', 'url': f"https://player.autoembed.cc/embed/movie/{tmdb_id}"})
                    else:
                        streams.append({'sourceName': 'VidSrc Embed', 'quality': '1080p', 'url': f"https://vidsrc.me/embed/tv?tmdb={tmdb_id}&season={season}&episode={episode}"})
                        streams.append({'sourceName': 'AutoEmbed Provider', 'quality': '1080p', 'url': f"https://player.autoembed.cc/embed/tv/{tmdb_id}/{season}/{episode}"})

                    self.wfile.write(json.dumps({'streams': streams}).encode('utf-8'))
                    return

                elif path == '/api/config':
                    self.wfile.write(json.dumps(cfg).encode('utf-8'))
                    return

                elif path == '/api/kodi/status':
                    self.wfile.write(json.dumps({'isPlaying': False, 'status': '待机就绪'}).encode('utf-8'))
                    return

                # If all else fails
                self.wfile.write(json.dumps({"results": []}).encode('utf-8'))

            except Exception as e:
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
                return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b'{}'

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()

        try:
            cfg = get_config()
            data = json.loads(post_data.decode('utf-8'))

            if path == '/api/kodi/play':
                kodi = cfg.get('kodi', {})
                target_url = f"http://{kodi.get('ip','192.168.1.100')}:{kodi.get('port',8080)}/jsonrpc"
                req_data = json.dumps({
                    "jsonrpc": "2.0",
                    "method": "Player.Open",
                    "params": {"item": {"file": data.get('url', '')}},
                    "id": 1
                }).encode('utf-8')

                req = urllib.request.Request(target_url, data=req_data, headers={'Content-Type': 'application/json'})
                try:
                    with urllib.request.urlopen(req, timeout=4) as resp:
                        res_body = json.loads(resp.read().decode('utf-8'))
                        self.wfile.write(json.dumps({'success': True, 'result': res_body}).encode('utf-8'))
                except Exception as ex:
                    self.wfile.write(json.dumps({'success': True, 'note': f"已尝试向 Kodi 发送 POST: {str(ex)}"}).encode('utf-8'))
                return

            elif path == '/api/kodi/settings':
                if 'jellyseerrUrl' in data:
                    cfg['jellyseerrUrl'] = data['jellyseerrUrl']
                if 'ip' in data:
                    cfg['kodi'] = data
                save_config(cfg)
                self.wfile.write(json.dumps({'success': True, 'config': cfg}).encode('utf-8'))
                return

        except Exception as e:
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))

if __name__ == '__main__':
    print(f"=======================================================")
    print(f" Real Jellyseerr Server: http://localhost:{PORT}")
    print(f"=======================================================")
    httpd = HTTPServer(('0.0.0.0', PORT), BridgeRequestHandler)
    httpd.serve_forever()
