"""Tiny Python microservice (standard library only)."""
import json
import os
import platform
import socket
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

START = time.time()


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/health", "/info"):
            self._send(200, {
                "service": "python-service",
                "status": "ok",
                "python": platform.python_version(),
                "container": socket.gethostname(),
                "os": f"{platform.system()} {platform.machine()}",
                "uptime_seconds": round(time.time() - START, 1),
            })
        else:
            self._send(404, {"error": "not found"})

    def log_message(self, fmt, *args):
        sys.stdout.write("python-service: " + fmt % args + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    print(f"python-service listening on :{port}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
