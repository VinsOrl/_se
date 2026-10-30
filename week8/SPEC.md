# homelab-watch pro: Spec

## Goal
Grow the single-file `homelab_watch.py` (attached, works, stdlib only) into a small installable monitor:
CLI report + history + tiny local dashboard + alerts. Keep it SIMPLE. No over-engineering.

- Python 3.11+ (Ubuntu 24.04), **stdlib only**, no pip dependencies, no CDN assets.
- Reuse the existing collectors from `homelab_watch.py`; refactor, don't rewrite from scratch.
- Command name: `hw` (entry: `python3 -m hw` plus a small `hw` launcher script).

## Layout (max ~6 files)
```
homelab-watch/
  hw/__init__.py
  hw/collectors.py   # all metric + check collectors
  hw/store.py        # SQLite history
  hw/alerts.py       # webhooks, state-change + cooldown
  hw/server.py       # http.server dashboard
  hw/cli.py          # argparse commands
  tests/             # unittest, a few focused tests
  README.md
  REPORT.md          # Claude Code writes findings/questions here
```

## Phase 1: Collectors + config
Keep existing: uptime/load, RAM/swap, disks, temps, failed systemd units, Docker, top memory users.
Add:
- **GPU** (only if `nvidia-smi` exists): util %, VRAM used/total, temp.
- **Network checks**: ping targets and DNS lookup (targets from config).
- **Service checks**: HTTP URL (expect status) and TCP port (host:port), from config.
- **Failed units detail**: last 5 `journalctl -u <unit>` lines per failed unit.
- **Docker extras**: unhealthy / restarting containers count as warnings.
- **Pending apt updates** count and **reboot required** (`/var/run/reboot-required`).
- **Backup age**: file/dir path in config, warn if mtime older than N hours.
- **Top CPU** processes (5) next to top memory.

Config: `~/.config/homelab-watch/config.toml` (parsed with `tomllib`).
- `hw init` writes a commented default config (thresholds, checks, alerts, retention).
- Every collector must degrade gracefully: tool missing = skip with a note, never crash.
- Each result has a status: `ok | warn | crit` (two thresholds where it makes sense, e.g. disk 85/95).

## Phase 2: History (SQLite)
- DB: `~/.local/share/homelab-watch/history.db` (sqlite3).
- `hw collect` takes one sample (all metrics + check statuses) and stores it.
- Retention in config (default 30 days), pruned on each collect.

## Phase 3: Dashboard
- `hw serve --port 8765` (binds 127.0.0.1 by default, `--host` to change).
- One embedded HTML page (inline CSS/JS, dark mode, auto-refresh 10s).
- Endpoints: `/` page, `/api/current`, `/api/history?hours=24`.
- Shows: overall verdict, per-section cards, sparklines (CPU load, RAM, disk, temp, GPU) for the last 24h. Draw sparklines with inline SVG/canvas, no libraries.
- Read-only. No auth (note in README: use localhost or a reverse proxy/Tailscale).

## Phase 4: Alerts
- Targets: Discord webhook, Telegram bot, generic JSON webhook (config).
- Alert on **state change** (ok to warn/crit, and a recovery message), per check.
- Cooldown (default 30 min) so it never spams.
- Secrets can come from env vars; warn if the config file is world-readable.
- `hw collect --alert` samples and sends. `hw test-alert` sends a test message.

## Phase 5: Install helpers
- `hw install-timer`: creates **systemd user** units (no sudo): timer every 5 min running `hw collect --alert`, and optional service for `hw serve`. Print what it did.
- `hw uninstall`: removes them.

## Phase 6: Safe self-heal (opt-in, rule-based, NOT arbitrary auto-fix)
Deterministic fixes for a small known set of problems. No AI/LLM deciding commands, no free-form shell from the web UI.

Config (`[remediation]`): `enabled = false` by default, `mode = "dry-run" | "ask" | "auto"` (default `dry-run`).
- `dry-run`: logs what it WOULD do.
- `ask`: dashboard shows a "Fix" button per issue (needs a local token from config, localhost only).
- `auto`: runs fixes itself during `hw collect`.

Allowlisted fixes only (each is a fixed command template, targets must be listed in config):
- Failed systemd unit in `fix_units = [...]` -> `systemctl restart <unit>`
- Exited/unhealthy container in `fix_containers = [...]` -> `docker restart <name>`
- Service check failing and mapped to a unit/container in config -> restart that target
- Disk above crit -> safe cleanup only: `apt-get clean`, `journalctl --vacuum-time=7d`, `docker image prune -f` (dangling only)
System-level restarts need privileges: default to user units, and document a minimal sudoers snippet limited to restarting the listed units (never blanket sudo).

Guardrails (must all be implemented):
- Max 3 attempts per target per hour, then stop and send a normal alert ("fix failed, needs a human").
- After each fix, re-run that check to verify; record success/failure.
- Never: reboot, delete user files, edit config files, kill arbitrary processes, run commands not in the allowlist.
- Every action goes to a `fix_log` table (time, target, command, result) and is shown on the dashboard.
- Alerts include "tried X, result Y".

## CLI summary
`hw report [-o file] [--format md|json]` | `hw check` (exit 0/1/2 = ok/warn/crit) | `hw collect [--alert] [--fix]` | `hw serve` | `hw init` | `hw test-alert` | `hw fix-log` | `hw install-timer` | `hw uninstall`

## Non-goals (v1)
Multi-host, auth/users, cloud, Docker image, pip packaging, plugins.

## Tests
A few `unittest` tests only: threshold logic, retention pruning, alert cooldown/state-change, config loading. Mock subprocess/file reads. Must pass with `python3 -m unittest`.

## Acceptance checklist
- [ ] `hw report` works with no config and no optional tools installed
- [ ] `hw init`, `hw collect`, `hw serve` work end to end; dashboard shows history after a few collects
- [ ] Alert fires once on failure, once on recovery, not on every run
- [ ] `hw install-timer` / `hw uninstall` work as a normal user
- [ ] Remediation is off by default; dry-run logs intended fixes without running them
- [ ] In auto mode, a stopped allowlisted service gets restarted, verified, and logged; after 3 failed tries it stops and alerts
- [ ] Anything not in the allowlist is never executed (test this)
- [ ] Tests pass; README has quickstart + config example

## Working rules for Claude Code
- Work phase by phase, commit after each phase.
- **Git: commits authored as me (GitHub: VinsOrl). NO Co-Authored-By, NO Claude attribution lines, nothing about Claude/AI in commit messages or PR text.**
- Put your report, findings, decisions, and any questions in `REPORT.md`. Your text replies must be 1-2 lines telling me to read it.
- If something is unclear, choose the simplest option, write the choice in `REPORT.md`, and keep going.
