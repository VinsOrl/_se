"""Opt-in self-heal. Fixed command templates only; targets must be listed in config.

Nothing here builds a command from check output or web input: plan() maps an issue to
(kind, name), argv is built from a template, and run_cmd() refuses any argv that is not in
the allowlist derived from config.
"""
import hmac
import re
import subprocess
import time

from . import store

NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.@:-]*$")
CLEANUP = [["sudo", "-n", "apt-get", "clean"],
           ["sudo", "-n", "journalctl", "--vacuum-time=7d"],
           ["docker", "image", "prune", "-f"]]


def unit_cmd(name, scope):
    # user units need no privileges; system units need the sudoers rule from the README
    return (["systemctl", "--user", "restart", name] if scope == "user"
            else ["sudo", "-n", "systemctl", "restart", name])


def container_cmd(name):
    return ["docker", "restart", name]


def listed(cfg):
    """(units, containers) that config allows us to restart."""
    r, ch = cfg["remediation"], cfg["checks"]
    mapped = [c for k in ("http", "tcp") for c in ch[k]]
    units = set(r["fix_units"]) | {c["fix_unit"] for c in mapped if c.get("fix_unit")}
    conts = set(r["fix_containers"]) | {c["fix_container"] for c in mapped if c.get("fix_container")}
    return {n for n in units if NAME.match(n)}, {n for n in conts if NAME.match(n)}


def allowed(cfg):
    units, conts = listed(cfg)
    a = {tuple(unit_cmd(n, s)) for n in units for s in ("user", "system")}
    a |= {tuple(container_cmd(n)) for n in conts}
    return a | {tuple(c) for c in CLEANUP}


def run_cmd(argv, cfg):
    if tuple(argv) not in allowed(cfg):
        return False, "refused: not in allowlist"
    try:
        r = subprocess.run(argv, capture_output=True, text=True, timeout=120)
    except Exception as e:
        return False, str(e)
    return r.returncode == 0, (r.stderr or r.stdout).strip()[-200:]


def plan(snap, cfg):
    """Allowlisted fixes for the current issues: [{key, target, cmds}]."""
    units, conts = listed(cfg)
    out, seen = [], set()
    for r in snap["results"]:
        if r["status"] == "ok":
            continue
        fx, key = r.get("fix"), r["key"]
        if fx and fx[0] == "unit" and fx[1] in units:
            p = {"target": f"unit:{fx[1]}", "cmds": [unit_cmd(fx[1], fx[2])]}
        elif fx and fx[0] == "container" and fx[1] in conts:
            p = {"target": f"container:{fx[1]}", "cmds": [container_cmd(fx[1])]}
        elif key.startswith("disk:") and r["status"] == "crit":
            p = {"target": "disk-cleanup", "cmds": CLEANUP}
        else:
            continue
        if p["target"] not in seen:
            seen.add(p["target"])
            out.append(dict(p, key=key))
    return out


def apply(con, cfg, snap, collect, mode=None, only=None, now=None, sleep=time.sleep, muted=()):
    """Run (or dry-run) the plan. Returns ({key: 'tried X, result Y'}, [message lines]).

    On a real fix the check is re-collected and `snap` is replaced with the fresh result.
    """
    rem = cfg["remediation"]
    mode, notes, msgs = mode or rem["mode"], {}, []
    for p in plan(snap, cfg):
        target = p["target"]
        if (only and target != only) or p["key"] in muted:
            continue
        cmdtxt = "; ".join(" ".join(c) for c in p["cmds"])
        if mode == "dry-run":
            if not store.recent_dry_runs(con, target, now):  # once an hour, not every tick
                store.log_fix(con, target, cmdtxt, "dry-run: would run", now)
            continue
        n = store.recent_attempts(con, target, now)
        if n >= rem["max_attempts"]:
            continue  # already gave up and escalated; stay quiet until the hour rolls over
        results = [run_cmd(c, cfg) for c in p["cmds"]]
        err = next((m for ok, m in results if not ok), None)
        if err is None:
            sleep(rem["settle_seconds"])
            fresh = collect(cfg)
            now_r = next((r for r in fresh["results"] if r["key"] == p["key"]), None)
            snap.update(fresh)
            if now_r is not None and now_r["status"] != "ok":
                err = f"still {now_r['status']} after fix"
        result = "ok" if err is None else f"failed: {err}"
        store.log_fix(con, target, cmdtxt, result, now)
        notes[p["key"]] = f"tried `{cmdtxt}`, result: {result}"
        if err is None:
            msgs.append(f"🔧 {target}: tried `{cmdtxt}`, result: ok (verified)")
        elif n + 1 >= rem["max_attempts"]:
            msgs.append(f"🚨 {target}: fix failed {n + 1}x in the last hour, needs a human "
                        f"(tried `{cmdtxt}`, result: {result})")
    return notes, msgs


def token_ok(want, got):
    return bool(want) and hmac.compare_digest(want.encode(), got.encode())
