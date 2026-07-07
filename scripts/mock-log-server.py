import json
from http.server import BaseHTTPRequestHandler, HTTPServer

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8')
        print(f'[MockServer] {self.command} {self.path}')
        try:
            data = json.loads(body)
            print(json.dumps(data, ensure_ascii=False, indent=2))
        except Exception as e:
            print('Raw body:', body)
            print('Parse error:', e)
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'ok': True}).encode('utf-8'))

if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', 9999), Handler)
    print('[MockServer] Listening on http://127.0.0.1:9999')
    server.serve_forever()
