"""SQLite history, fix log, alert state."""
import json
import sqlite3
import time
from pathlib import Path

DB_PATH = Path.home() / ".local/share/homelab-watch/history.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS samples(ts INTEGER PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS fix_log(id INTEGER PRIMARY KEY, ts INTEGER, target TEXT,
                                   command TEXT, result TEXT);
CREATE TABLE IF NOT EXISTS alert_state(key TEXT PRIMARY KEY, status TEXT, text TEXT,
                                       last_alert INTEGER, alerted INTEGER,
                                       bad INTEGER DEFAULT 0);
"""


def connect(path=DB_PATH):
    if str(path) != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path)
    con.executescript(SCHEMA)
    try:  # DBs created by v1 lack the flap counter
        con.execute("ALTER TABLE alert_state ADD COLUMN bad INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    return con


def save(con, snap, retention_days):
    """Store a slim sample (status, metrics, per-check status) and prune old rows."""
    data = {"status": snap["status"], "metrics": snap["metrics"],
            "checks": {r["key"]: r["status"] for r in snap["results"]}}
    cutoff = snap["ts"] - retention_days * 86400
    con.execute("INSERT OR REPLACE INTO samples VALUES(?,?)", (snap["ts"], json.dumps(data)))
    con.execute("DELETE FROM samples WHERE ts < ?", (cutoff,))
    con.execute("DELETE FROM fix_log WHERE ts < ?", (cutoff,))
    con.commit()


def history(con, hours=24, now=None):
    since = (now or time.time()) - hours * 3600
    rows = con.execute("SELECT ts, data FROM samples WHERE ts >= ? ORDER BY ts", (since,))
    return [dict(json.loads(d), ts=ts) for ts, d in rows]


def log_fix(con, target, command, result, ts=None):
    con.execute("INSERT INTO fix_log(ts, target, command, result) VALUES(?,?,?,?)",
                (int(ts or time.time()), target, command, result))
    con.commit()


def fix_log(con, limit=50):
    rows = con.execute("SELECT ts, target, command, result FROM fix_log ORDER BY id DESC LIMIT ?",
                       (limit,))
    return [dict(zip(("ts", "target", "command", "result"), r)) for r in rows]


def recent_attempts(con, target, now=None, window=3600):
    """Real fix attempts (not dry-runs) for a target in the last `window` seconds."""
    return con.execute("SELECT COUNT(*) FROM fix_log WHERE target=? AND ts>=? AND "
                       "(result='ok' OR result LIKE 'failed%')",
                       (target, (now or time.time()) - window)).fetchone()[0]
