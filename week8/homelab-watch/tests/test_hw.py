import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from hw import alerts, collectors, fix, store

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


if __name__ == "__main__":
    unittest.main()
