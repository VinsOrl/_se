"""Webhook alerts: per-check state change + cooldown."""
import json
import os
import sys
import urllib.request

from .collectors import ICON


def secret(sec, name):
    """Config value, or the env var named by `<name>_env`."""
    return sec.get(name) or os.environ.get(sec.get(name + "_env", ""), "")


def post_json(url, payload):
    req = urllib.request.Request(url, json.dumps(payload).encode(),
                                 {"Content-Type": "application/json", "User-Agent": "homelab-watch"})
    urllib.request.urlopen(req, timeout=10).read()


def send(cfg, text, host="", lines=()):
    """Send to every configured target. Returns [(target, error-or-None)]."""
    a, jobs = cfg["alerts"], []
    if url := secret(a.get("discord", {}), "webhook_url"):
        jobs.append(("discord", lambda: post_json(url, {"content": text[:2000]})))
    tg = a.get("telegram", {})
    if (token := secret(tg, "bot_token")) and tg.get("chat_id"):
        jobs.append(("telegram", lambda: post_json(
            f"https://api.telegram.org/bot{token}/sendMessage",
            {"chat_id": tg["chat_id"], "text": text[:4000]})))
    if url := secret(a.get("webhook", {}), "url"):
        jobs.append(("webhook", lambda: post_json(url, {"text": text, "host": host,
                                                       "messages": list(lines)})))
    res = []
    for name, fn in jobs:
        try:
            fn()
            res.append((name, None))
        except Exception as e:
            res.append((name, str(e)))
    return res


def process(con, cfg, snap, notes=None, extra=(), send=send):
    """Compare each check with its last known state; send one batched message.

    - bad for `min_samples` samples in a row: alert (unless within the cooldown of the last alert)
    - warn <-> crit while alerted: alert again
    - back to ok: recovery message, only if a failure alert was actually sent
    - unchanged: silence
    Returns the list of message lines.
    """
    now, notes = snap["ts"], notes or {}
    cool = cfg["alerts"]["cooldown_minutes"] * 60
    current = {r["key"]: (r["status"], r["text"]) for r in snap["results"]}
    # checks that vanished (e.g. a failed unit that recovered) count as ok
    for key, st, text in con.execute("SELECT key, status, text FROM alert_state"):
        if key not in current and st != "ok":
            current[key] = ("ok", text)
    lines, need = [], cfg["alerts"]["min_samples"]
    for key, (st, text) in current.items():
        row = con.execute("SELECT status, last_alert, alerted, bad FROM alert_state WHERE key=?",
                          (key,)).fetchone()
        old, last, alerted, bad = row or ("ok", None, 0, 0)
        if st == "ok":
            if not row:
                continue
            if alerted:
                lines.append(f"✅ RECOVERED: {text}")
            alerted, bad = 0, 0
        else:
            bad += 1
            # alert once the streak is long enough; again only if it changes warn <-> crit
            fresh = not alerted or st != old
            if bad >= need and fresh and (last is None or now - last >= cool):
                tried = f" ({notes[key]})" if key in notes else ""
                lines.append(f"{ICON[st]} {st.upper()}: {text}{tried}")
                alerted, last = 1, now
        con.execute("INSERT OR REPLACE INTO alert_state VALUES(?,?,?,?,?,?)",
                    (key, st, text, last, alerted, bad))
    con.commit()
    lines += list(extra)
    if lines:
        text = f"[{snap['host']}]\n" + "\n".join(lines)
        for name, err in send(cfg, text, snap["host"], lines):
            if err:
                print(f"alert to {name} failed: {err}", file=sys.stderr)
    return lines


def test_alert(cfg):
    res = send(cfg, "homelab-watch test alert", os.uname().nodename, ["test"])
    if not res:
        print("no alert targets configured ([alerts.discord|telegram|webhook])")
    for name, err in res:
        print(f"{name}: {'ok' if err is None else 'FAILED ' + err}")
    return all(e is None for _, e in res) and bool(res)
