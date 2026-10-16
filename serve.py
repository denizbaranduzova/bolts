#!/usr/bin/env python3
"""Studio server: static files + POST /levels.json, kept in sync with the page."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import time

ROOT = Path(__file__).resolve().parent
LEVELS = ROOT / "levels.json"
INDEX = ROOT / "index.html"
PORT = 8773


def sync_embedded_levels(payload):
    if not INDEX.exists():
        return
    text = INDEX.read_text(encoding="utf-8")
    needle = "window.EMBEDDED_LEVELS = "
    start = text.find(needle)
    if start < 0:
        return
    json_start = start + len(needle)
    try:
        _, end_rel = json.JSONDecoder().raw_decode(text[json_start:])
    except json.JSONDecodeError:
        return
    blob = json.dumps(payload, separators=(",", ":"))
    INDEX.write_text(text[:json_start] + blob + text[json_start + end_rel :], encoding="utf-8")


def write_catalog(data):
    if isinstance(data, list):
        levels = data
    elif isinstance(data, dict) and isinstance(data.get("levels"), list):
        levels = data["levels"]
    else:
        raise ValueError("catalog")
    payload = {"rev": int(time.time() * 1000), "levels": levels}
    LEVELS.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    try:
        sync_embedded_levels(payload)
    except Exception:
        pass


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path != "/levels.json":
            self.send_error(404)
            return
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n)
        try:
            payload = json.loads(raw.decode("utf-8"))
            write_catalog(payload)
        except Exception:
            self.send_error(400, "Invalid catalog")
            return
        body = b'{"ok":true}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        path = (getattr(self, "path", "") or "").split("?", 1)[0]
        if path in ("/", "/index.html", "/levels.json") or path.endswith(".js"):
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        try:
            self._cors()
        except Exception:
            pass
        super().end_headers()


if __name__ == "__main__":
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("Serving Bolts on http://127.0.0.1:%s/" % PORT, flush=True)
    httpd.serve_forever()
