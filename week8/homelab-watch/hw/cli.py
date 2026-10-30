"""argparse commands."""
import argparse
import datetime
import json
import secrets
import subprocess
import sys
from pathlib import Path

from . import alerts, collectors, fix, store


def cmd_report(a, cfg):
    snap = collectors.collect_all(cfg)
    text = json.dumps(snap, indent=2) if a.format == "json" else collectors.render_md(snap)
    if a.out:
        open(a.out, "w").write(text)
        print(f"Wrote {a.out} ({snap['status']})")
    else:
        print(text)


def cmd_check(a, cfg):
    snap = collectors.collect_all(cfg)
    for r in snap["results"]:
        if r["status"] != "ok":
            print(f"{r['status'].upper()}: {r['text']}")
    print(f"overall: {snap['status']}")
    sys.exit(collectors.RANK[snap["status"]])


def cmd_collect(a, cfg):
    snap = collectors.collect_all(cfg)
    con = store.connect()
    rem, notes, msgs = cfg["remediation"], {}, []
    if a.fix and not rem["enabled"]:
        print("remediation is disabled ([remediation] enabled = false): no fixes run")
    elif rem["enabled"] and (rem["mode"] != "ask" or a.fix):
        # ask mode only acts when explicitly requested with --fix (or via the dashboard button)
        notes, msgs = fix.apply(con, cfg, snap, collectors.collect_all,
                                mode="auto" if rem["mode"] == "ask" else rem["mode"])
        for m in msgs:
            print(m)
    store.save(con, snap, cfg["history"]["retention_days"])
    if a.alert:
        sent = alerts.process(con, cfg, snap, notes, msgs)
        print(f"alerts: {len(sent)} line(s) sent")
    print(f"stored sample: {snap['status']} ({len(snap['results'])} checks)")


def cmd_fix_log(a, cfg):
    for f in reversed(store.fix_log(store.connect(), a.limit)):
        when = datetime.datetime.fromtimestamp(f["ts"])
        print(f"{when:%Y-%m-%d %H:%M:%S}  {f['target']:<24} {f['result']:<28} {f['command']}")


def cmd_test_alert(a, cfg):
    sys.exit(0 if alerts.test_alert(cfg) else 1)


def cmd_serve(a, cfg):
    from . import server
    server.serve(cfg, a.host, a.port)


UNITS = ("hw-collect.timer", "hw-collect.service", "hw-serve.service")


def unit_dir():
    return Path.home() / ".config/systemd/user"


def systemctl(*args):
    try:
        r = subprocess.run(["systemctl", "--user", *args], capture_output=True, text=True)
        return r.returncode == 0, (r.stderr or r.stdout).strip()
    except FileNotFoundError:
        return False, "systemctl not found"


def cmd_install_timer(a, cfg):
    root = Path(__file__).resolve().parent.parent
    py = sys.executable
    files = {
        "hw-collect.service": f"""[Unit]
Description=homelab-watch sample + alerts

[Service]
Type=oneshot
Environment=PYTHONPATH={root}
ExecStart={py} -m hw collect --alert
""",
        "hw-collect.timer": """[Unit]
Description=homelab-watch every 5 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
Unit=hw-collect.service

[Install]
WantedBy=timers.target
""",
    }
    if a.serve:
        files["hw-serve.service"] = f"""[Unit]
Description=homelab-watch dashboard

[Service]
Environment=PYTHONPATH={root}
ExecStart={py} -m hw serve --port {a.port}
Restart=on-failure

[Install]
WantedBy=default.target
"""
    d = unit_dir()
    d.mkdir(parents=True, exist_ok=True)
    for name, text in files.items():
        (d / name).write_text(text)
        print(f"wrote {d / name}")
    steps = [("daemon-reload",), ("enable", "--now", "hw-collect.timer")]
    if a.serve:
        steps.append(("enable", "--now", "hw-serve.service"))
    for st in steps:
        ok, msg = systemctl(*st)
        print(f"systemctl --user {' '.join(st)}: {'ok' if ok else 'FAILED ' + msg}")
    print("Timer runs `hw collect --alert` every 5 min. To keep it running while logged out: "
          "loginctl enable-linger $USER")


def cmd_uninstall(a, cfg):
    for name in UNITS:
        if (unit_dir() / name).exists():
            if name != "hw-collect.service":
                systemctl("disable", "--now", name)
            (unit_dir() / name).unlink()
            print(f"removed {name}")
    systemctl("daemon-reload")
    print("done (config and history are kept)")


def cmd_init(a, cfg):
    p = collectors.CONFIG_PATH
    if p.exists() and not a.force:
        sys.exit(f"{p} exists (use --force to overwrite)")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(collectors.DEFAULT_TOML.replace("@TOKEN@", secrets.token_hex(16)))
    p.chmod(0o600)
    print(f"Wrote {p}")


def main(argv=None):
    ap = argparse.ArgumentParser(prog="hw", description="homelab-watch")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("report", help="print a health report")
    s.add_argument("-o", "--out")
    s.add_argument("--format", choices=["md", "json"], default="md")
    s.set_defaults(fn=cmd_report)
    sub.add_parser("check", help="exit 0/1/2 = ok/warn/crit").set_defaults(fn=cmd_check)
    s = sub.add_parser("collect", help="take one sample and store it")
    s.add_argument("--alert", action="store_true", help="send alerts on state change")
    s.add_argument("--fix", action="store_true", help="apply remediation now (needed in 'ask' mode)")
    s.set_defaults(fn=cmd_collect)
    s = sub.add_parser("fix-log", help="show remediation history")
    s.add_argument("--limit", type=int, default=50)
    s.set_defaults(fn=cmd_fix_log)
    sub.add_parser("test-alert", help="send a test message").set_defaults(fn=cmd_test_alert)
    s = sub.add_parser("serve", help="local dashboard")
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--port", type=int, default=8765)
    s.set_defaults(fn=cmd_serve)
    s = sub.add_parser("install-timer", help="systemd --user timer (+ optional dashboard)")
    s.add_argument("--serve", action="store_true", help="also install the dashboard service")
    s.add_argument("--port", type=int, default=8765)
    s.set_defaults(fn=cmd_install_timer)
    sub.add_parser("uninstall", help="remove the systemd user units").set_defaults(fn=cmd_uninstall)
    s = sub.add_parser("init", help="write default config")
    s.add_argument("--force", action="store_true")
    s.set_defaults(fn=cmd_init)
    a = ap.parse_args(argv)
    cfg = collectors.load_config()
    for w in cfg["_warnings"]:
        print(f"warning: {w}", file=sys.stderr)
    a.fn(a, cfg)
