"""All metric + check collectors, config loading, markdown rendering."""
import copy
import datetime
import os
import shutil
import socket
import subprocess
import time
import tomllib
import urllib.error
import urllib.request
from pathlib import Path

CONFIG_PATH = Path.home() / ".config/homelab-watch/config.toml"
RANK = {"ok": 0, "warn": 1, "crit": 2}
ICON = {"ok": "✅", "warn": "⚠️", "crit": "❌"}

SKIP_FS = {"proc", "sysfs", "devtmpfs", "tmpfs", "cgroup", "cgroup2", "overlay",
           "squashfs", "devpts", "securityfs", "pstore", "bpf", "tracefs",
           "debugfs", "mqueue", "hugetlbfs", "fusectl", "configfs", "autofs",
           "efivarfs", "binfmt_misc", "nsfs", "ramfs", "rpc_pipefs"}

DEFAULTS = {
    "thresholds": {"disk_warn": 85, "disk_crit": 95, "mem_warn": 90, "mem_crit": 97,
                   "temp_warn": 80, "temp_crit": 90, "gpu_temp_warn": 80,
                   "gpu_temp_crit": 90, "load_warn": 1.5, "load_crit": 3.0},
    "history": {"retention_days": 30},
    "checks": {"ping": [], "dns": [], "http": [], "tcp": [], "backup": []},
    "alerts": {"cooldown_minutes": 30},
    "remediation": {"enabled": False, "mode": "dry-run", "token": "",
                    "fix_units": [], "fix_containers": [], "max_attempts": 3,
                    "settle_seconds": 3},
}

DEFAULT_TOML = """\
# homelab-watch config. Every value is optional; defaults are shown.

[thresholds]            # status is warn above *_warn, crit above *_crit
disk_warn = 85          # % used
disk_crit = 95
mem_warn = 90           # % RAM used
mem_crit = 97
temp_warn = 80          # deg C
temp_crit = 90
gpu_temp_warn = 80
gpu_temp_crit = 90
load_warn = 1.5         # 1-min load per CPU core
load_crit = 3.0

[history]
retention_days = 30

[checks]
ping = []               # e.g. ["1.1.1.1", "192.168.1.1"]
dns = []                # e.g. ["example.com"]

# [[checks.http]]       # repeat the block for more checks
# name = "grafana"
# url = "http://localhost:3000/api/health"
# expect = 200
# fix_unit = "grafana-server"      # optional: restart target (remediation)
# fix_container = "grafana"        # optional

# [[checks.tcp]]
# name = "postgres"
# host = "localhost"
# port = 5432

# [[checks.backup]]
# name = "nightly"
# path = "/mnt/backup/latest"
# max_age_hours = 26

[alerts]
cooldown_minutes = 30
# Secrets may come from env vars: use e.g. webhook_url_env = "HW_DISCORD_URL"
# [alerts.discord]
# webhook_url = "https://discord.com/api/webhooks/..."
# [alerts.telegram]
# bot_token = "123:abc"       # or bot_token_env = "HW_TG_TOKEN"
# chat_id = "12345"
# [alerts.webhook]            # generic: POSTs {"text": ..., "host": ..., "messages": [...]}
# url = "https://example.com/hook"

[remediation]           # opt-in, allowlisted fixes only. See README.
enabled = false
mode = "dry-run"        # "dry-run" | "ask" | "auto"
token = "@TOKEN@"       # dashboard Fix button (mode = "ask")
fix_units = []          # failed units that may be restarted, e.g. ["grafana-server"]
fix_containers = []     # containers that may be restarted
max_attempts = 3        # per target per hour
settle_seconds = 3      # wait before re-checking after a fix
"""


def load_config(path=CONFIG_PATH):
    cfg = copy.deepcopy(DEFAULTS)
    cfg["_warnings"] = []
    path = Path(path)
    if path.exists():
        try:
            user = tomllib.loads(path.read_text())
        except tomllib.TOMLDecodeError as e:
            raise SystemExit(f"bad config {path}: {e}")
        for sec, val in user.items():
            if isinstance(val, dict) and isinstance(cfg.get(sec), dict):
                cfg[sec].update(val)
            else:
                cfg[sec] = val
        if path.stat().st_mode & 0o004:
            cfg["_warnings"].append(f"{path} is world-readable (chmod 600 it; it may hold secrets)")
    return cfg


def level(v, warn, crit):
    return "crit" if v > crit else "warn" if v > warn else "ok"


def worst(results):
    return max((r["status"] for r in results), key=RANK.get, default="ok")


class Out:
    def __init__(self):
        self.results, self.notes = [], []

    def add(self, section, key, status, text, value=None, detail=None, **extra):
        r = {"section": section, "key": key, "status": status, "text": text}
        if value is not None:
            r["value"] = value
        if detail:
            r["detail"] = detail
        r.update(extra)
        self.results.append(r)

    def note(self, msg):
        self.notes.append(msg)


def run(cmd, timeout=10):
    """stdout of cmd, or None if it failed / is missing."""
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip() if r.returncode == 0 else None
    except Exception:
        return None


def gb(n):
    return f"{n / 1024**3:.1f} GB"


def uptime_load():
    try:
        secs = float(Path("/proc/uptime").read_text().split()[0])
        load = os.getloadavg()
    except Exception:
        return None, None, os.cpu_count() or 1
    d, rem = divmod(int(secs), 86400)
    h, rem = divmod(rem, 3600)
    return f"{d}d {h}h {rem // 60}m", load, os.cpu_count() or 1


def memory():
    info = {}
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            k, v = line.split(":")
            info[k] = int(v.split()[0]) * 1024
    except Exception:
        return None
    total = info["MemTotal"]
    used = total - info.get("MemAvailable", info["MemFree"])
    swap_t = info.get("SwapTotal", 0)
    return total, used, swap_t, swap_t - info.get("SwapFree", 0)


def disks():
    seen, out = set(), []
    try:
        lines = Path("/proc/mounts").read_text().splitlines()
    except Exception:
        return out
    for line in lines:
        dev, mnt, fs = line.split()[:3]
        if fs in SKIP_FS or dev in seen or not dev.startswith("/"):
            continue
        seen.add(dev)
        try:
            u = shutil.disk_usage(mnt)
        except Exception:
            continue
        out.append((mnt, u.total, u.used, u.used / u.total * 100 if u.total else 0))
    return out


def temps():
    out, base = [], "/sys/class/thermal"
    if os.path.isdir(base):
        for z in sorted(os.listdir(base)):
            if z.startswith("thermal_zone"):
                try:
                    t = int(Path(f"{base}/{z}/temp").read_text()) / 1000
                    out.append((z, Path(f"{base}/{z}/type").read_text().strip(), t))
                except Exception:
                    pass
    return out


# ---- collectors: fn(cfg, out) ------------------------------------------------

def c_system(cfg, out):
    t = cfg["thresholds"]
    up, load, cpus = uptime_load()
    if up:
        out.add("System", "uptime", "ok", f"Uptime: {up}")
        out.add("System", "load", level(load[0] / cpus, t["load_warn"], t["load_crit"]),
                f"Load (1/5/15m): {load[0]:.2f} / {load[1]:.2f} / {load[2]:.2f} on {cpus} cores",
                value=load[0])
    m = memory()
    if m:
        total, used, st, su = m
        pct = used / total * 100
        out.add("System", "ram", level(pct, t["mem_warn"], t["mem_crit"]),
                f"RAM: {gb(used)} / {gb(total)} ({pct:.0f}%)", value=pct)
        if st:
            out.add("System", "swap", "ok", f"Swap: {gb(su)} / {gb(st)}")
    else:
        out.note("/proc/meminfo unreadable: RAM skipped")


def c_disks(cfg, out):
    t = cfg["thresholds"]
    for mnt, tot, used, pct in disks():
        out.add("Disks", f"disk:{mnt}", level(pct, t["disk_warn"], t["disk_crit"]),
                f"{mnt}: {gb(used)} / {gb(tot)} ({pct:.0f}%)", value=pct)


def c_temps(cfg, out):
    t = cfg["thresholds"]
    for zone, name, c in temps():
        out.add("Temperatures", f"temp:{zone}", level(c, t["temp_warn"], t["temp_crit"]),
                f"{name}: {c:.0f}°C", value=c)


def c_gpu(cfg, out):
    if not shutil.which("nvidia-smi"):
        return
    t = cfg["thresholds"]
    o = run(["nvidia-smi", "--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu",
             "--format=csv,noheader,nounits"])
    if o is None:
        return out.note("nvidia-smi failed: GPU skipped")
    for i, line in enumerate(o.splitlines()):
        try:
            util, used, total, temp = (float(x) for x in line.split(","))
        except ValueError:
            continue
        out.add("GPU", f"gpu:{i}", level(temp, t["gpu_temp_warn"], t["gpu_temp_crit"]),
                f"GPU {i}: {util:.0f}% util, VRAM {used:.0f}/{total:.0f} MiB, {temp:.0f}°C",
                value=util, temp=temp)


def c_units(cfg, out):
    scopes = (("system", ["systemctl"]), ("user", ["systemctl", "--user"]))
    if not shutil.which("systemctl"):
        return out.note("systemctl missing: failed units skipped")
    found = False
    for scope, base in scopes:
        o = run(base + ["--failed", "--no-legend", "--plain"])
        if o is None:
            if scope == "system":
                out.note("systemd not available: failed units skipped")
            continue
        for line in o.splitlines():
            if not line.strip():
                continue
            unit, found = line.split()[0], True
            jc = ["journalctl"] + (["--user"] if scope == "user" else []) + ["-u", unit, "-n", "5", "--no-pager"]
            log = run(jc) or "(no journal access)"
            out.add("Failed services", f"unit:{unit}", "warn", f"Failed unit: {unit}",
                    detail=log, fix=["unit", unit, scope])
    if not found:
        out.add("Failed services", "units", "ok", "No failed units")


def c_docker(cfg, out):
    if not shutil.which("docker"):
        return
    o = run(["docker", "ps", "-a", "--format", "{{.Names}}|{{.Status}}|{{.Image}}"])
    if o is None:
        return out.note("docker not reachable (permissions?): Docker skipped")
    rows = [l.split("|") for l in o.splitlines() if l.strip()]
    if not rows:
        out.add("Docker", "docker", "ok", "No containers")
    for name, status, image in rows:
        bad = not status.startswith("Up") or "unhealthy" in status or "Restarting" in status
        out.add("Docker", f"container:{name}", "warn" if bad else "ok",
                f"{name} ({image}): {status}", fix=["container", name] if bad else None)


def c_updates(cfg, out):
    if shutil.which("apt-get"):
        o = run(["apt-get", "-s", "upgrade"], timeout=30)
        if o is not None:
            n = sum(1 for l in o.splitlines() if l.startswith("Inst "))
            out.add("Updates", "apt", "ok", f"Pending apt updates: {n}", value=n)
    if os.path.exists("/var/run/reboot-required"):
        out.add("Updates", "reboot", "warn", "Reboot required")


def c_checks(cfg, out):
    ch = cfg["checks"]
    for host in ch["ping"]:
        if not shutil.which("ping"):
            out.note("ping missing: ping checks skipped")
            break
        try:
            ok = subprocess.run(["ping", "-c", "1", "-W", "2", host], capture_output=True,
                                timeout=5).returncode == 0
        except Exception:
            ok = False
        out.add("Network", f"ping:{host}", "ok" if ok else "crit",
                f"ping {host}: {'ok' if ok else 'unreachable'}")
    for name in ch["dns"]:
        try:
            socket.getaddrinfo(name, None)
            ok = True
        except OSError:
            ok = False
        out.add("Network", f"dns:{name}", "ok" if ok else "crit",
                f"dns {name}: {'resolves' if ok else 'FAILED'}")
    for c in ch["http"]:
        name, want = c.get("name") or c["url"], c.get("expect", 200)
        try:
            code = urllib.request.urlopen(c["url"], timeout=5).status
        except urllib.error.HTTPError as e:
            code = e.code
        except Exception as e:
            code = str(e)[:60]
        ok = code == want
        out.add("Services", f"http:{name}", "ok" if ok else "crit",
                f"{name}: HTTP {code} (expect {want})", **_fix_hint(c))
    for c in ch["tcp"]:
        name = c.get("name") or f"{c['host']}:{c['port']}"
        try:
            socket.create_connection((c["host"], int(c["port"])), timeout=3).close()
            ok = True
        except OSError:
            ok = False
        out.add("Services", f"tcp:{name}", "ok" if ok else "crit",
                f"{name} ({c['host']}:{c['port']}): {'open' if ok else 'closed'}", **_fix_hint(c))
    for c in ch["backup"]:
        name, limit = c.get("name") or c["path"], c.get("max_age_hours", 26)
        try:
            age = (time.time() - os.stat(c["path"]).st_mtime) / 3600
        except OSError:
            out.add("Backups", f"backup:{name}", "crit", f"{name}: {c['path']} missing")
            continue
        out.add("Backups", f"backup:{name}", "warn" if age > limit else "ok",
                f"{name}: last modified {age:.1f}h ago (limit {limit}h)", value=age)


def _fix_hint(c):
    """Restart target mapped to a service check in config, if any."""
    if c.get("fix_unit"):
        return {"fix": ["unit", c["fix_unit"], c.get("fix_scope", "user")]}
    if c.get("fix_container"):
        return {"fix": ["container", c["fix_container"]]}
    return {}


def c_top(cfg, out):
    o = run(["ps", "-eo", "pid,pmem,pcpu,comm", "--sort=-pmem"])
    if o:
        rows = [l.split(None, 3) for l in o.splitlines()[1:]]
        mem = [f"{r[3]} (pid {r[0]}): {r[1]}%" for r in rows[:5] if len(r) == 4]
        cpu = sorted(rows, key=lambda r: -float(r[2]))[:5]
        out.add("Top processes", "top_mem", "ok", "Top memory", detail="\n".join(mem))
        out.add("Top processes", "top_cpu", "ok", "Top CPU",
                detail="\n".join(f"{r[3]} (pid {r[0]}): {r[2]}%" for r in cpu if len(r) == 4))


COLLECTORS = [c_system, c_disks, c_temps, c_gpu, c_units, c_docker, c_updates, c_checks, c_top]


def collect_all(cfg):
    out = Out()
    for fn in COLLECTORS:
        try:
            fn(cfg, out)
        except Exception as e:  # a collector must never crash the run
            out.note(f"{fn.__name__} failed: {e}")
    return finalize({"host": os.uname().nodename, "ts": int(time.time()),
                     "results": out.results, "notes": out.notes})


def finalize(snap):
    """(Re)compute overall status + sparkline metrics from snap['results']."""
    res = snap["results"]
    val = {r["key"]: r["value"] for r in res if "value" in r}
    pick = lambda pre: [r["value"] for r in res if r["key"].startswith(pre) and "value" in r]
    m = {"load": val.get("load"), "ram": val.get("ram"),
         "disk": max(pick("disk:"), default=None), "temp": max(pick("temp:"), default=None),
         "gpu": val.get("gpu:0")}
    snap["metrics"] = {k: v for k, v in m.items() if v is not None}
    snap["status"] = worst(res)
    return snap


def render_md(snap):
    res = snap["results"]
    when = datetime.datetime.fromtimestamp(snap["ts"])
    L = [f"# Health report: {snap['host']}", f"_{when:%Y-%m-%d %H:%M}_\n", "## Verdict"]
    bad = [r for r in res if r["status"] != "ok"]
    L += [f"- {ICON[r['status']]} {r['text']}" for r in bad] or ["- All good ✅"]
    sections = {}
    for r in res:
        sections.setdefault(r["section"], []).append(r)
    for name, rows in sections.items():
        L.append(f"\n## {name}")
        for r in rows:
            L.append(f"- {ICON[r['status']]} {r['text']}")
            for d in (r.get("detail") or "").splitlines():
                L.append(f"    - {d}")
    if snap["notes"]:
        L.append("\n## Notes")
        L += [f"- {n}" for n in snap["notes"]]
    return "\n".join(L) + "\n"
