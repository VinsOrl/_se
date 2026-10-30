import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import json
import threading
import urllib.request

from hw import alerts, collectors, fix, server, store
from hw.engine import Engine

DAY = 86400


def snap(results, ts=1_000_000):
    return collectors.finalize({"host": "h", "ts": ts, "notes": [], "results": [
        {"section": "S", "key": k, "status": st, "text": f"{k} is {st}"} for k, st in results]})


class Thresholds(unittest.TestCase):
    def test_level(self):
        self.assertEqual(collectors.level(85, 85, 95), "ok")
        self.assertEqual(collectors.level(86, 85, 95), "warn")
        self.assertEqual(collectors.level(96, 85, 95), "crit")

    def test_disk_uses_config_thresholds(self):
        cfg = collectors.load_config("/nonexistent")
        out = collectors.Out()
        with mock.patch.object(collectors, "disks", return_value=[("/", 100, 90, 90.0)]):
            collectors.c_disks(cfg, out)
        self.assertEqual(out.results[0]["status"], "warn")

    def test_missing_tool_is_skipped_not_crash(self):
        cfg = collectors.load_config("/nonexistent")
        with mock.patch.object(collectors.shutil, "which", return_value=None):
            s = collectors.collect_all(cfg)
        self.assertIn(s["status"], collectors.RANK)

    def test_collector_crash_is_marked_unavailable_not_fatal(self):
        cfg = collectors.load_config("/nonexistent")
        with mock.patch.object(collectors, "memory", side_effect=RuntimeError("boom")):
            s = collectors.collect_all(cfg)
        bad = [r for r in s["results"] if r["key"] == "collector:c_system"]
        self.assertIn("boom", bad[0]["text"])
        self.assertTrue(any(r["key"] == "disk:/" for r in s["results"]))  # others still ran


class Containers(unittest.TestCase):
    def rows(self, status, ignore=()):
        cfg = collectors.load_config("/nonexistent")
        cfg["checks"]["ignore_containers"] = list(ignore)
        out = collectors.Out()
        with mock.patch.object(collectors.shutil, "which", return_value="/x"), \
                mock.patch.object(collectors, "run", return_value=f"c|{status}|img"):
            collectors.c_docker(cfg, out)
        return out.results

    def test_status_rules(self):
        for status, want in [("Up 2 hours", "ok"), ("Exited (0) 2 weeks ago", "ok"),
                             ("Exited (1) 5 minutes ago", "warn"), ("Restarting (1) 3s ago", "warn"),
                             ("Up 1 hour (unhealthy)", "warn")]:
            self.assertEqual(self.rows(status)[0]["status"], want, status)

    def test_ignored(self):
        self.assertEqual(self.rows("Exited (1) now", ignore=["c"]), [])


class Config(unittest.TestCase):
    def test_defaults_and_override_and_world_readable_warning(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d, "c.toml")
            p.write_text('[thresholds]\ndisk_warn = 70\n[remediation]\nmode = "auto"\n')
            p.chmod(0o644)
            cfg = collectors.load_config(p)
        self.assertEqual(cfg["thresholds"]["disk_warn"], 70)
        self.assertEqual(cfg["thresholds"]["disk_crit"], 95)
        self.assertFalse(cfg["remediation"]["enabled"])
        self.assertEqual(cfg["remediation"]["mode"], "auto")
        self.assertTrue(cfg["_warnings"])

    def test_default_toml_parses(self):
        import tomllib
        tomllib.loads(collectors.DEFAULT_TOML)


class Retention(unittest.TestCase):
    def test_prune_old_samples(self):
        con = store.connect(":memory:")
        now = 100 * DAY
        store.save(con, snap([("a", "ok")], now - 40 * DAY), 30)
        store.save(con, snap([("a", "ok")], now - 10 * DAY), 30)
        store.save(con, snap([("a", "ok")], now), 30)
        self.assertEqual(len(store.history(con, hours=100 * 24, now=now)), 2)

    def test_history_window(self):
        con = store.connect(":memory:")
        store.save(con, snap([("a", "ok")], 1000), 30)
        store.save(con, snap([("a", "ok")], 1000 + 7200), 30)
        self.assertEqual(len(store.history(con, hours=1, now=1000 + 7200)), 1)


class Migration(unittest.TestCase):
    def test_v1_db_gets_bad_column(self):
        with tempfile.TemporaryDirectory() as d:
            import sqlite3
            c = sqlite3.connect(Path(d, "h.db"))
            c.execute("CREATE TABLE alert_state(key TEXT PRIMARY KEY, status TEXT, text TEXT, "
                      "last_alert INTEGER, alerted INTEGER)")
            c.commit(); c.close()
            con = store.connect(Path(d, "h.db"))
            con.execute("SELECT bad FROM alert_state")


class Alerts(unittest.TestCase):
    def setUp(self):
        self.con = store.connect(":memory:")
        self.cfg = collectors.load_config("/nonexistent")
        self.cfg["alerts"]["min_samples"] = 1
        self.sent = []
        self.send = lambda cfg, text, host="", lines=(): self.sent.append(text) or []

    def run_(self, results, ts, **kw):
        return alerts.process(self.con, self.cfg, snap(results, ts), send=self.send, **kw)

    def test_fires_once_then_recovery_once(self):
        self.assertEqual(self.run_([("x", "ok")], 0), [])
        self.assertEqual(len(self.run_([("x", "crit")], 300)), 1)
        self.assertEqual(self.run_([("x", "crit")], 600), [])      # still failing: silent
        self.assertEqual(self.run_([("x", "crit")], 900), [])
        rec = self.run_([("x", "ok")], 1200)
        self.assertEqual(len(rec), 1)
        self.assertIn("RECOVERED", rec[0])
        self.assertEqual(self.run_([("x", "ok")], 1500), [])
        self.assertEqual(len(self.sent), 2)

    def test_cooldown_suppresses_flapping(self):
        self.run_([("x", "crit")], 0)
        self.run_([("x", "ok")], 60)
        self.assertEqual(self.run_([("x", "crit")], 120), [])      # within 30 min
        self.assertEqual(len(self.run_([("x", "crit")], 31 * 60 + 200)), 1)  # still bad, cooldown over

    def test_flap_protection_needs_consecutive_bad_samples(self):
        self.cfg["alerts"]["min_samples"] = 2
        self.assertEqual(self.run_([("t", "warn")], 0), [])        # 1st bad sample
        self.assertEqual(self.run_([("t", "ok")], 300), [])        # blip, resets
        self.assertEqual(self.run_([("t", "warn")], 600), [])
        self.assertEqual(len(self.run_([("t", "warn")], 900)), 1)  # 2nd in a row
        self.assertEqual(self.run_([("t", "warn")], 1200), [])

    def test_blip_never_alerts_or_recovers(self):
        self.cfg["alerts"]["min_samples"] = 2
        self.run_([("t", "warn")], 0)
        self.assertEqual(self.run_([("t", "ok")], 300), [])

    def test_vanished_check_counts_as_recovery(self):
        self.run_([("unit:a", "warn")], 0)
        rec = self.run_([("other", "ok")], 300)
        self.assertEqual(len(rec), 1)

    def test_note_included(self):
        out = self.run_([("x", "crit")], 0, notes={"x": "tried restart, result failed"})
        self.assertIn("tried restart", out[0])

    def test_secret_from_env(self):
        with mock.patch.dict(os.environ, {"HW_URL": "http://e"}):
            self.assertEqual(alerts.secret({"url_env": "HW_URL"}, "url"), "http://e")


class Remediation(unittest.TestCase):
    def setUp(self):
        self.con = store.connect(":memory:")
        self.cfg = collectors.load_config("/nonexistent")
        self.cfg["remediation"].update(enabled=True, mode="auto", fix_units=["web"], settle_seconds=0)
        self.issue = lambda: {"host": "h", "ts": 1000, "notes": [], "results": [
            {"section": "S", "key": "unit:web", "status": "warn", "text": "Failed unit: web",
             "fix": ["unit", "web", "user"]}]}

    def collect_ok(self, cfg):
        return snap([("unit:web", "ok")])

    def test_not_in_allowlist_is_never_executed(self):
        with mock.patch.object(fix.subprocess, "run") as run:
            for argv in (["rm", "-rf", "/"], ["systemctl", "--user", "restart", "other"],
                         ["docker", "restart", "db"], ["sudo", "reboot"],
                         ["systemctl", "--user", "restart", "web", "--now"]):
                ok, msg = fix.run_cmd(argv, self.cfg)
                self.assertFalse(ok)
                self.assertIn("refused", msg)
            run.assert_not_called()

    def test_unlisted_target_not_planned(self):
        s = self.issue()
        s["results"][0]["fix"] = ["unit", "sshd", "system"]
        self.assertEqual(fix.plan(s, self.cfg), [])
        s["results"][0]["fix"] = ["unit", "-rf", "user"]
        self.cfg["remediation"]["fix_units"] = ["-rf"]
        self.assertEqual(fix.plan(s, self.cfg), [])

    def test_dry_run_logs_but_does_not_run(self):
        with mock.patch.object(fix.subprocess, "run") as run:
            fix.apply(self.con, self.cfg, self.issue(), self.collect_ok, mode="dry-run")
        run.assert_not_called()
        self.assertIn("dry-run", store.fix_log(self.con)[0]["result"])
        self.assertEqual(store.recent_attempts(self.con, "unit:web", 1000), 0)

    def test_auto_fix_restarts_verifies_logs(self):
        ran = mock.Mock(returncode=0, stdout="", stderr="")
        s = self.issue()
        with mock.patch.object(fix.subprocess, "run", return_value=ran) as run:
            notes, msgs = fix.apply(self.con, self.cfg, s, self.collect_ok, now=1000)
        run.assert_called_once()
        self.assertEqual(run.call_args[0][0], ["systemctl", "--user", "restart", "web"])
        self.assertEqual(store.fix_log(self.con)[0]["result"], "ok")
        self.assertEqual(s["status"], "ok")
        self.assertIn("verified", msgs[0])

    def test_three_failures_then_stop_and_escalate(self):
        ran = mock.Mock(returncode=0, stdout="", stderr="")
        still_bad = lambda cfg: self.issue()
        all_msgs = []
        with mock.patch.object(fix.subprocess, "run", return_value=ran) as run:
            for i in range(5):
                _, msgs = fix.apply(self.con, self.cfg, self.issue(), still_bad, now=1000 + i)
                all_msgs += msgs
        self.assertEqual(run.call_count, 3)
        self.assertEqual(len(all_msgs), 1)
        self.assertIn("needs a human", all_msgs[0])

    def test_attempts_expire_after_an_hour(self):
        ran = mock.Mock(returncode=0, stdout="", stderr="")
        with mock.patch.object(fix.subprocess, "run", return_value=ran) as run:
            for i in range(3):
                fix.apply(self.con, self.cfg, self.issue(), lambda c: self.issue(), now=1000 + i)
            fix.apply(self.con, self.cfg, self.issue(), lambda c: self.issue(), now=1000 + 3700)
        self.assertEqual(run.call_count, 4)

    def test_token(self):
        self.assertFalse(fix.token_ok("", ""))
        self.assertTrue(fix.token_ok("abc", "abc"))
        self.assertFalse(fix.token_ok("abc", "abd"))


class Mutes(unittest.TestCase):
    def test_mute_expire_unmute(self):
        con = store.connect(":memory:")
        store.mute(con, "k", 3600, now=100)
        self.assertIn("k", store.muted(con, now=200))
        self.assertNotIn("k", store.muted(con, now=100 + 3600))
        store.mute(con, "k", 3600, now=100)
        store.mute(con, "k", 0)
        self.assertEqual(store.muted(con, now=200), {})

    def test_muted_issue_does_not_alert(self):
        con, cfg, sent = store.connect(":memory:"), collectors.load_config("/x"), []
        cfg["alerts"]["min_samples"] = 1
        out = alerts.process(con, cfg, snap([("x", "crit")]), muted={"x": 1},
                             send=lambda *a, **k: sent.append(a) or [])
        self.assertEqual((out, sent), ([], []))

    def test_muted_issue_is_not_fixed(self):
        con, cfg = store.connect(":memory:"), collectors.load_config("/x")
        cfg["remediation"].update(fix_units=["web"], mode="auto", enabled=True)
        s = snap([("unit:web", "warn")])
        s["results"][0]["fix"] = ["unit", "web", "user"]
        with mock.patch.object(fix.subprocess, "run") as run:
            fix.apply(con, cfg, s, lambda c: s, muted={"unit:web": 1})
        run.assert_not_called()

    def test_crashed_collector_does_not_cause_false_recovery(self):
        con, cfg = store.connect(":memory:"), collectors.load_config("/x")
        cfg["alerts"]["min_samples"] = 1
        alerts.process(con, cfg, snap([("disk:/", "crit")]), send=lambda *a, **k: [])
        out = alerts.process(con, cfg, snap([("collector:c_disks", "warn")], 2000),
                             send=lambda *a, **k: [])
        self.assertFalse(any("RECOVERED" in l for l in out))


class EngineTests(unittest.TestCase):
    def test_snapshot_ready_and_history_thinning(self):
        cfg = collectors.load_config("/x")
        e = Engine(cfg, ":memory:")
        self.assertFalse(e.ready())
        for t in collectors.TIERS:
            e.run_tier(t)
        self.assertTrue(e.ready())
        self.assertIn("cpu", {r["key"] for r in e.snapshot()["results"]})
        con = store.connect(":memory:")
        for i in range(1000):
            store.save(con, snap([("a", "ok")], 10_000 + i * 60), 30)
        self.assertLessEqual(len(store.history(con, 24 * 30, now=10_000 + 60_000, points=300)), 300)

    def test_lock_is_exclusive(self):
        with tempfile.TemporaryDirectory() as d:
            a = store.try_lock(Path(d, "l"))
            self.assertIsNone(store.try_lock(Path(d, "l")))
            a.close()
            b = store.try_lock(Path(d, "l"))
            self.assertIsNotNone(b)
            b.close()


class Api(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.TemporaryDirectory()
        self.cfg = collectors.load_config("/x")
        self.cfg["remediation"]["token"] = "tok"
        self.db = Path(self.d.name, "h.db")
        self.engine = Engine(self.cfg, self.db)
        for t in collectors.TIERS:
            self.engine.run_tier(t)
        self.srv = server.ThreadingHTTPServer(("127.0.0.1", 0), server.make_handler(self.cfg, self.engine, self.db))
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.srv.server_port}"

    def tearDown(self):
        self.srv.shutdown()
        self.srv.server_close()
        self.d.cleanup()

    def post(self, path, body, token=None):
        req = urllib.request.Request(self.url + path, json.dumps(body).encode(),
                                     {"X-HW-Token": token} if token else {})
        try:
            r = urllib.request.urlopen(req)
        except urllib.error.HTTPError as e:
            r = e
        return r.status, json.load(r)

    def test_current_is_cached_and_fast(self):
        with mock.patch.object(collectors, "run") as run:
            d = json.load(urllib.request.urlopen(self.url + "/api/current"))
        run.assert_not_called()
        self.assertTrue(d["ready"] and d["actions"])

    def test_actions_need_token_and_valid_input(self):
        self.assertEqual(self.post("/api/mute", {"key": "k", "hours": 1})[0], 403)
        self.assertEqual(self.post("/api/mute", {"key": "k", "hours": 1}, "bad")[0], 403)
        self.assertEqual(self.post("/api/mute", {"key": "k", "hours": 7}, "tok")[0], 400)
        self.assertEqual(self.post("/api/mute", {"key": "k", "hours": 1}, "tok")[0], 200)
        self.assertEqual(self.post("/api/fix", {"key": "k"}, "tok")[0], 403)  # not in ask mode
        self.assertEqual(self.post("/api/nope", {}, "tok")[0], 404)
        self.assertEqual(self.post("/api/mute", {"key": "k" * 5000, "hours": 1}, "tok")[0], 413)

    def test_sse_sends_full_snapshot_first(self):
        r = urllib.request.urlopen(self.url + "/events")
        self.assertIn("text/event-stream", r.headers["Content-Type"])
        line = ""
        while not line.startswith("data:"):
            line = r.readline().decode()
        ev = json.loads(line[5:])
        self.assertTrue(ev["full"] and ev["results"])
        r.close()


if __name__ == "__main__":
    unittest.main()
