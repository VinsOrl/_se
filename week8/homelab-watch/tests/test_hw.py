import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from hw import alerts, collectors, store

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

    def test_collector_exception_becomes_note(self):
        cfg = collectors.load_config("/nonexistent")
        with mock.patch.object(collectors, "memory", side_effect=RuntimeError("boom")):
            s = collectors.collect_all(cfg)
        self.assertTrue(any("boom" in n for n in s["notes"]))


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


class Alerts(unittest.TestCase):
    def setUp(self):
        self.con = store.connect(":memory:")
        self.cfg = collectors.load_config("/nonexistent")
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
        self.assertEqual(len(self.run_([("x", "crit")], 0 + 31 * 60 + 200)), 0)  # no change, no alert
        self.run_([("x", "ok")], 4000)
        self.assertEqual(len(self.run_([("x", "crit")], 5000)), 1)  # cooldown over

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


if __name__ == "__main__":
    unittest.main()
