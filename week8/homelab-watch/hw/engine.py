"""Live engine for `hw serve`: tiered collector threads, one shared in-memory snapshot,
alerts + remediation + history on timers."""
import functools
import sys
import threading

from . import alerts, collectors, fix, store


class Engine:
    def __init__(self, cfg, db_path=store.DB_PATH):
        self.cfg, self.db_path = cfg, db_path
        self.parts = {}  # collector name -> (results, notes)
        self.version = 0
        self.cond = threading.Condition()
        self.locks = {t: threading.Lock() for t in collectors.TIERS}
        self.stop = threading.Event()

    # -- state
    def run_tier(self, tier):
        with self.locks[tier]:  # a manual refresh never overlaps the tier's own loop
            fresh = {fn.__name__: collectors.run_one(fn, self.cfg) for fn in collectors.TIERS[tier]}
            with self.cond:
                self.parts.update(fresh)
                self.version += 1
                self.cond.notify_all()

    def snapshot(self):
        with self.cond:
            parts = dict(self.parts)
        return collectors.merge(parts)

    def ready(self):
        return len(self.parts) == len(collectors.COLLECTORS)

    def refresh(self, tiers=("fast", "medium")):
        for t in tiers:
            self.run_tier(t)
        return self.snapshot()

    def wait(self, version, timeout):
        """Block until the snapshot changes (or timeout/stop); returns the current version."""
        with self.cond:
            self.cond.wait_for(lambda: self.version != version or self.stop.is_set(), timeout)
            return self.version

    # -- timers
    def evaluate(self):
        if not self.ready():  # half a snapshot would look like mass recoveries
            return
        con = store.connect(self.db_path)
        try:
            snap, muted = self.snapshot(), store.muted(con)
            rem, notes, msgs = self.cfg["remediation"], {}, []
            if rem["enabled"] and rem["mode"] != "ask":
                notes, msgs = fix.apply(con, self.cfg, snap, lambda c: self.refresh(), muted=muted)
            alerts.process(con, self.cfg, snap, notes, msgs, muted=muted)
        finally:
            con.close()

    def save_history(self):
        con = store.connect(self.db_path)
        try:
            store.save(con, self.snapshot(), self.cfg["history"]["retention_days"])
        finally:
            con.close()

    def every(self, label, interval, fn, first=0):
        def loop():
            if self.stop.wait(first):
                return
            while True:
                try:
                    fn()
                except Exception as e:  # one bad tick must not kill the loop
                    print(f"{label} failed: {e!r}", file=sys.stderr)
                if self.stop.wait(interval):
                    return
        threading.Thread(target=loop, name=label, daemon=True).start()

    def start(self):
        e = self.cfg["engine"]
        for tier in collectors.TIERS:
            self.every(tier, e[tier], functools.partial(self.run_tier, tier))
        self.every("evaluate", e["eval"], self.evaluate, first=e["eval"])
        self.every("history", e["history"], self.save_history, first=5)

    def shutdown(self):
        self.stop.set()
        with self.cond:
            self.cond.notify_all()
