"""Local read-only QA viewer; only the solar calculation POST is forwarded.

No project/auth proxy or geometry write route. Bind loopback exclusively.
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError


class Handler(SimpleHTTPRequestHandler):
    def solar_proxy(self):
        allowed = {'/editor/api/solar/module': 'GET', '/editor/api/solar/estimate': 'POST'}
        if allowed.get(self.path) != self.command:
            self.send_error(405)
            return
        size = int(self.headers.get('Content-Length', 0))
        if not 0 <= size <= 65536:
            self.send_error(413)
            return
        body = self.rfile.read(size) if self.command == 'POST' else None
        req = Request('http://127.0.0.1:5100'+self.path, data=body,
                      headers={'Content-Type':'application/json'}, method=self.command)
        try:
            response = urlopen(req, timeout=40)
        except HTTPError as exc:
            response = exc
        with response:
            data = response.read(2_000_001)
            self.send_response(response.status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith('/editor/api/solar/'):
            return self.solar_proxy()
        return super().do_GET()

    def do_POST(self):
        return self.solar_proxy()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory',required=True)
    parser.add_argument('--port',type=int,default=5184)
    args=parser.parse_args()
    ThreadingHTTPServer(('127.0.0.1',args.port),partial(Handler,directory=args.directory)).serve_forever()
