#!/usr/bin/env python3
"""homelab-watch: one-file health report for a Linux box. Stdlib only.

Usage:
  python3 homelab_watch.py                 # print markdown report
  python3 homelab_watch.py -o report.md    # write to file
  python3 homelab_watch.py --disk 80 --mem 85 --temp 75   # custom thresholds
Exit code: 0 = all good, 1 = warnings found (handy for cron / scripts).
"""
import argparse
import datetime
import os
import shutil
import subprocess
import sys

SKIP_FS = {"proc", "sysfs", "devtmpfs", "tmpfs", "cgroup", "cgroup2", "overlay",
           "squashfs", "devpts", "securityfs", "pstore", "bpf", "tracefs",
           "debugfs", "mqueue", "hugetlbfs", "fusectl", "configfs", "autofs",
           "efivarfs", "binfmt_misc", "nsfs", "ramfs", "rpc_pipefs"}


def run(cmd):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return r.stdout.strip()
    except Exception:
        return None


def uptime_load():
    try:
        secs = float(open("/proc/uptime").read().split()[0])
        load = os.getloadavg()
    except Exception:
        return None, None, os.cpu_count() or 1
    d, rem = divmod(int(secs), 86400)
    h, rem = divmod(rem, 3600)
    return f"{d}d {h}h {rem // 60}m", load, os.cpu_count() or 1


def memory():
    info = {}
    try:
        for line in open("/proc/meminfo"):
            k, v = line.split(":")
            info[k] = int(v.split()[0]) * 1024
    except Exception:
        return None
    total = info["MemTotal"]
    used = total - info.get("MemAvailable", info["MemFree"])
    swap_t = info.get("SwapTotal", 0)
    swap_u = swap_t - info.get("SwapFree", 0)
    return total, used, swap_t, swap_u


def disks():
    seen, out = set(), []
    try:
        lines = open("/proc/mounts").read().splitlines()
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
    out = []
    base = "/sys/class/thermal"
    if os.path.isdir(base):
        for z in sorted(os.listdir(base)):
            if z.startswith("thermal_zone"):
                try:
                    t = int(open(f"{base}/{z}/temp").read()) / 1000
                    name = open(f"{base}/{z}/type").read().strip()
                    out.append((name, t))
                except Exception:
                    pass
    return out


def failed_units():
    if not shutil.which("systemctl"):
        return None
    o = run(["systemctl", "--failed", "--no-legend", "--plain"])
    if o is None:
        return None
    return [l.split()[0] for l in o.splitlines() if l.strip()]


def docker():
    if not shutil.which("docker"):
        return None
    o = run(["docker", "ps", "-a", "--format", "{{.Names}}|{{.Status}}|{{.Image}}"])
    if o is None:
        return None
    return [l.split("|") for l in o.splitlines() if l.strip()]


def top_mem():
    o = run(["ps", "-eo", "pid,pmem,comm", "--sort=-pmem"])
    if not o:
        return []
    return [l.split(None, 2) for l in o.splitlines()[1:6]]


def gb(n):
    return f"{n / 1024**3:.1f} GB"


def main():
    ap = argparse.ArgumentParser(description="Markdown health report for a Linux box")
    ap.add_argument("-o", "--out", help="write report to this file")
    ap.add_argument("--disk", type=float, default=85, help="disk %% warn (default 85)")
    ap.add_argument("--mem", type=float, default=90, help="RAM %% warn (default 90)")
    ap.add_argument("--temp", type=float, default=80, help="temp C warn (default 80)")
    a = ap.parse_args()

    warns = []
    L = []
    host = os.uname().nodename
    L.append(f"# Health report: {host}")
    L.append(f"_{datetime.datetime.now():%Y-%m-%d %H:%M}_\n")

    up, load, cpus = uptime_load()
    L.append("## System")
    if up:
        L.append(f"- Uptime: {up}")
        L.append(f"- Load (1/5/15m): {load[0]:.2f} / {load[1]:.2f} / {load[2]:.2f} on {cpus} cores")
        if load[0] > cpus * 1.5:
            warns.append(f"High load: {load[0]:.2f} on {cpus} cores")
    m = memory()
    if m:
        total, used, st, su = m
        pct = used / total * 100
        L.append(f"- RAM: {gb(used)} / {gb(total)} ({pct:.0f}%)")
        if st:
            L.append(f"- Swap: {gb(su)} / {gb(st)}")
        if pct > a.mem:
            warns.append(f"RAM at {pct:.0f}%")

    L.append("\n## Disks")
    L.append("| Mount | Used | Total | % |\n|---|---|---|---|")
    for mnt, tot, used, pct in disks():
        flag = " ⚠️" if pct > a.disk else ""
        L.append(f"| {mnt} | {gb(used)} | {gb(tot)} | {pct:.0f}%{flag} |")
        if pct > a.disk:
            warns.append(f"Disk {mnt} at {pct:.0f}%")

    t = temps()
    if t:
        L.append("\n## Temperatures")
        for name, c in t:
            flag = " ⚠️" if c > a.temp else ""
            L.append(f"- {name}: {c:.0f}°C{flag}")
            if c > a.temp:
                warns.append(f"{name} at {c:.0f}°C")

    f = failed_units()
    L.append("\n## Failed services")
    if f is None:
        L.append("- systemd not available")
    elif not f:
        L.append("- None ✅")
    else:
        for u in f:
            L.append(f"- ❌ {u}")
            warns.append(f"Failed unit: {u}")

    d = docker()
    if d is not None:
        L.append("\n## Docker")
        if not d:
            L.append("- No containers")
        for name, status, image in d:
            bad = not status.startswith("Up")
            L.append(f"- {'❌' if bad else '✅'} {name} ({image}): {status}")
            if bad:
                warns.append(f"Container not running: {name}")

    tm = top_mem()
    if tm:
        L.append("\n## Top memory users")
        for pid, pm, comm in tm:
            L.append(f"- {comm} (pid {pid}): {pm}%")

    L.insert(2, "## Verdict\n" + ("\n".join(f"- ⚠️ {w}" for w in warns) if warns else "- All good ✅") + "\n")
    report = "\n".join(L) + "\n"

    if a.out:
        open(a.out, "w").write(report)
        print(f"Wrote {a.out} ({len(warns)} warning(s))")
    else:
        print(report)
    sys.exit(1 if warns else 0)


if __name__ == "__main__":
    main()
