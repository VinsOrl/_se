"""Dashboard + API (stdlib http.server). Reads come from the engine cache; never collects per request.

Writes are POST /api/{fix,check,test-alert,mute}: localhost + X-HW-Token only, and the server
looks up any command itself."""
import json
import signal
import threading
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from . import alerts, collectors, fix, store
from .engine import Engine

PAGE = (Path(__file__).parent / "page.html").read_text()

LOCAL = ("127.0.0.1", "::1", "::ffff:127.0.0.1")
MUTE_HOURS = (0, 1, 24)  # 0 = unmute


def view(cfg, con, snap, client=None):
    """Snapshot + what the page may offer: fixable issues, active mutes, whether actions work."""
    rem = cfg["remediation"]
    ask = rem["enabled"] and rem["mode"] == "ask"
    return dict(snap, muted=store.muted(con),
                fixable=[p["key"] for p in fix.plan(snap, cfg)] if ask else [],
                actions=bool(rem["token"]) and (client is None or client in LOCAL))


def make_handler(cfg, engine, db_path):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def send(self, code, body, ctype="application/json"):
            data = body.encode() if isinstance(body, str) else json.dumps(body).encode()
            self.send_response(code)
            self.send_header("Content-Type", ctype + "; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            u = urlparse(self.path)
            if u.path == "/":
                return self.send(200, PAGE, "text/html")
            if u.path == "/events":
                return self.events()
            con = store.connect(db_path)
            try:
                if u.path == "/api/current":
                    self.send(200, dict(view(cfg, con, engine.snapshot(), self.client_address[0]),
                                        ready=engine.ready()))
                elif u.path == "/api/history":
                    try:
                        hours = float(parse_qs(u.query).get("hours", ["24"])[0])
                    except ValueError:
                        return self.send(400, {"error": "bad hours"})
                    self.send(200, store.history(con, hours))
                elif u.path == "/api/fixlog":
                    self.send(200, store.fix_log(con))
                else:
                    self.send(404, {"error": "not found"})
            finally:
                con.close()

        def events(self):
            """Server-sent events: full snapshot first, then only the results that changed."""
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            sent = None
            try:
                while not engine.stop.is_set():
                    version = engine.version  # read before the snapshot so no change is missed
                    con = store.connect(db_path)
                    try:
                        snap = view(cfg, con, engine.snapshot(), self.client_address[0])
                    finally:
                        con.close()
                    cur = {r["key"]: r for r in snap["results"]}
                    changed = [r for k, r in cur.items() if sent is None or sent.get(k) != r]
                    gone = [] if sent is None else [k for k in sent if k not in cur]
                    if sent is None or changed or gone:
                        meta = {k: snap[k] for k in ("host", "ts", "status", "metrics", "notes",
                                                     "muted", "fixable", "actions")}
                        ev = dict(meta, results=changed, gone=gone, full=sent is None)
                        self.wfile.write(f"event: update\ndata: {json.dumps(ev)}\n\n".encode())
                    else:
                        self.wfile.write(b"event: ping\ndata: {}\n\n")
                    self.wfile.flush()
                    sent = cur
                    engine.wait(version, 15)
            except OSError:  # client went away
                pass

        def do_POST(self):
            name = urlparse(self.path).path.removeprefix("/api/").replace("-", "_")
            if name not in ("fix", "check", "test_alert", "mute"):
                return self.send(404, {"error": "not found"})
            if self.client_address[0] not in LOCAL:
                return self.send(403, {"error": "localhost only"})
            if not fix.token_ok(cfg["remediation"]["token"], self.headers.get("X-HW-Token", "")):
                return self.send(403, {"error": "bad or missing token"})
            try:
                n = int(self.headers.get("Content-Length", 0))
                if not 0 <= n <= 4096:
                    return self.send(413, {"error": "body too large"})
                body = json.loads(self.rfile.read(n) or b"{}")
            except ValueError:
                return self.send(400, {"error": "bad request"})
            con = store.connect(db_path)
            try:
                code, res = getattr(self, "act_" + name)(con, body)
            finally:
                con.close()
            self.send(code, res)

        def act_fix(self, con, body):
            rem = cfg["remediation"]
            if not (rem["enabled"] and rem["mode"] == "ask"):
                return 403, {"error": "remediation mode is not 'ask'"}
            snap = engine.snapshot()
            plans = [p for p in fix.plan(snap, cfg) if p["key"] == body.get("key")]
            if not plans:
                return 404, {"error": "no allowlisted fix for that issue"}
            notes, msgs = fix.apply(con, cfg, snap, lambda c: engine.refresh(), mode="auto",
                                    only=plans[0]["target"])
            return 200, {"messages": msgs or list(notes.values()) or ["attempt limit reached"]}

        def act_check(self, con, body):
            snap = engine.refresh(tuple(collectors.TIERS))
            return 200, {"status": snap["status"], "ts": snap["ts"]}

        def act_test_alert(self, con, body):
            res = alerts.send(cfg, "homelab-watch test alert", engine.snapshot()["host"], ["test"])
            if not res:
                return 400, {"error": "no alert targets configured"}
            return 200, {"results": [{"target": n, "error": e} for n, e in res]}

        def act_mute(self, con, body):
            key, hours = body.get("key"), body.get("hours")
            if not isinstance(key, str) or not key or len(key) > 200 or hours not in MUTE_HOURS:
                return 400, {"error": "need key and hours in (0, 1, 24)"}
            store.mute(con, key, hours * 3600)
            return 200, {"muted": store.muted(con)}

    return Handler


def serve(cfg, host, port, db_path=store.DB_PATH, lock_path=store.LOCK_PATH):
    lock = store.try_lock(lock_path)  # held until exit; keeps `hw collect --alert` out
    if lock is None:
        raise SystemExit("another `hw serve` is already running")
    engine = Engine(cfg, db_path)
    srv = ThreadingHTTPServer((host, port), make_handler(cfg, engine, db_path))
    srv.daemon_threads = True
    # shutdown() must run off the serving thread
    signal.signal(signal.SIGTERM, lambda *_: threading.Thread(target=srv.shutdown).start())
    engine.start()
    print(f"hw serve: http://{host}:{port}/  (Ctrl-C or SIGTERM to stop)", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        engine.shutdown()
        srv.server_close()
        lock.close()
