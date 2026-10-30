"""argparse commands."""
import argparse
import json
import secrets
import sys

from . import alerts, collectors, store


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
    store.save(con, snap, cfg["history"]["retention_days"])
    if a.alert:
        sent = alerts.process(con, cfg, snap)
        print(f"alerts: {len(sent)} line(s) sent")
    print(f"stored sample: {snap['status']} ({len(snap['results'])} checks)")


def cmd_test_alert(a, cfg):
    sys.exit(0 if alerts.test_alert(cfg) else 1)


def cmd_serve(a, cfg):
    from . import server
    server.serve(cfg, a.host, a.port)


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
    s.set_defaults(fn=cmd_collect)
    sub.add_parser("test-alert", help="send a test message").set_defaults(fn=cmd_test_alert)
    s = sub.add_parser("serve", help="local dashboard")
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--port", type=int, default=8765)
    s.set_defaults(fn=cmd_serve)
    s = sub.add_parser("init", help="write default config")
    s.add_argument("--force", action="store_true")
    s.set_defaults(fn=cmd_init)
    a = ap.parse_args(argv)
    cfg = collectors.load_config()
    for w in cfg["_warnings"]:
        print(f"warning: {w}", file=sys.stderr)
    a.fn(a, cfg)
