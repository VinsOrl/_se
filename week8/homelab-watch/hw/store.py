"""SQLite history, fix log, alert state."""
import fcntl
import json
import sqlite3
import time
from pathlib import Path

DB_PATH = Path.home() / ".local/share/homelab-watch/history.db"
LOCK_PATH = DB_PATH.with_name("serve.lock")

SCHEMA = """
CREATE TABLE IF NOT EXISTS samples(ts INTEGER PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS fix_log(id INTEGER PRIMARY KEY, ts INTEGER, target TEXT,
                                   command TEXT, result TEXT);
CREATE TABLE IF NOT EXISTS mutes(key TEXT PRIMARY KEY, until INTEGER);
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
    """Store a slim sample (overall status + metrics) and prune old rows."""
    data = {"status": snap["status"], "metrics": snap["metrics"]}
    cutoff = snap["ts"] - retention_days * 86400
    con.execute("INSERT OR REPLACE INTO samples VALUES(?,?)", (snap["ts"], json.dumps(data)))
    con.execute("DELETE FROM samples WHERE ts < ?", (cutoff,))
    con.execute("DELETE FROM fix_log WHERE ts < ?", (cutoff,))
    con.commit()


def history(con, hours=24, now=None, points=300):
    """Samples in the window, thinned to about `points` (every n-th row) for big ranges."""
    since = (now or time.time()) - hours * 3600
    rows = con.execute("SELECT ts, data FROM samples WHERE ts >= ? ORDER BY ts", (since,)).fetchall()
    step = max(1, -(-len(rows) // points))
    return [dict(json.loads(d), ts=ts) for ts, d in rows[::step]]


def mute(con, key, seconds, now=None):
    """Mute `key` for `seconds` (<= 0 unmutes)."""
    if seconds <= 0:
        con.execute("DELETE FROM mutes WHERE key=?", (key,))
    else:
        con.execute("INSERT OR REPLACE INTO mutes VALUES(?,?)", (key, int((now or time.time()) + seconds)))
    con.commit()


def muted(con, now=None):
    """{key: until} of active mutes; expired ones are dropped."""
    now = int(now or time.time())
    con.execute("DELETE FROM mutes WHERE until <= ?", (now,))
    return dict(con.execute("SELECT key, until FROM mutes"))


def try_lock(path=LOCK_PATH):
    """Exclusive lock held for the life of the returned file object; None if someone has it."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    f = open(path, "w")
    try:
        fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return f
    except BlockingIOError:
        f.close()
        return None


def log_fix(con, target, command, result, ts=None):
    con.execute("INSERT INTO fix_log(ts, target, command, result) VALUES(?,?,?,?)",
                (int(ts or time.time()), target, command, result))
    con.commit()


def fix_log(con, limit=50):
    rows = con.execute("SELECT ts, target, command, result FROM fix_log ORDER BY id DESC LIMIT ?",
                       (limit,))
    return [dict(zip(("ts", "target", "command", "result"), r)) for r in rows]


def _recent(con, target, now, cond, window=3600):
    return con.execute(f"SELECT COUNT(*) FROM fix_log WHERE target=? AND ts>=? AND ({cond})",
                       (target, (now or time.time()) - window)).fetchone()[0]


def recent_attempts(con, target, now=None):
    """Real fix attempts (not dry-runs) in the last hour."""
    return _recent(con, target, now, "result='ok' OR result LIKE 'failed%'")


def recent_dry_runs(con, target, now=None):
    return _recent(con, target, now, "result LIKE 'dry-run%'")
