# homelab-watch pro

Small health monitor for a Linux box: CLI report, SQLite history, local dashboard, webhook
alerts, opt-in allowlisted self-heal. Python 3.11+, stdlib only, no CDN.

## Quickstart (recommended: one live process)
```bash
cd homelab-watch
bin/hw init                  # writes ~/.config/homelab-watch/config.toml (chmod 600)
$EDITOR ~/.config/homelab-watch/config.toml   # checks, alert targets, thresholds
bin/hw install-service       # systemd *user* service: restarts on failure
# dashboard: http://127.0.0.1:8765
```
`hw serve` does everything by itself: live metrics (CPU/RAM/temps/GPU/network every 2 s, disks,
Docker, units and network checks every 30 s, apt/backups every 10 min), history in SQLite every
60 s, alerts and remediation. No timer or `hw collect` needed. Try it first with `bin/hw serve`.

Other commands: `bin/hw report` (no config needed), `bin/hw uninstall`. `python3 -m hw ...` works from
this directory; put `bin/` on your PATH to type just `hw`.

Headless fallback (no long-running process): `hw install-timer` runs `hw collect --alert` every
5 min. `hw collect --alert/--fix` exits immediately while `hw serve` is running (lock file), so
alerts never double-send.

| Command | What |
|---|---|
| `hw report [-o f] [--format md\|json]` | full report |
| `hw check` | prints problems, exit 0/1/2 = ok/warn/crit |
| `hw collect [--alert] [--fix]` | sample + store; alert on state change; `--fix` applies remediation in `ask` mode |
| `hw serve [--host H] [--port P]` | live engine + dashboard, 127.0.0.1:8765 by default |
| `hw install-service [--port P]` | `hw serve` as a systemd user service (recommended) |
| `hw test-alert` | send a test message to all configured targets |
| `hw fix-log` | what the self-heal did / would do |
| `hw install-timer [--serve]`, `hw uninstall` | headless timer fallback; remove all units |

Missing tools (docker, nvidia-smi, systemd, ...) are skipped with a note, never a crash.

## Config example (`~/.config/homelab-watch/config.toml`)
`hw init` writes a fully commented version. Minimal example:
```toml
[thresholds]
disk_warn = 80

[checks]
ping = ["1.1.1.1"]
dns = ["example.com"]

[[checks.http]]
name = "grafana"
url = "http://localhost:3000/api/health"
expect = 200
fix_container = "grafana"      # optional restart target for remediation

[[checks.tcp]]
host = "localhost"
port = 5432

[[checks.backup]]
name = "nightly"
path = "/mnt/backup/latest"
max_age_hours = 26

[alerts]
cooldown_minutes = 30
[alerts.discord]
webhook_url_env = "HW_DISCORD_URL"   # or webhook_url = "..."
```
Status is `warn` above `*_warn` and `crit` above `*_crit`. Failed service/network checks are `crit`.

## Alerts
Discord webhook, Telegram bot (`bot_token` + `chat_id`), or generic JSON webhook
(`{"text", "host", "messages"}`). One message per run, only when a check **changes** state; a
recovery message follows once the check is ok again (only if its failure alert was sent). A
check must be bad `min_samples` (default 2) evaluations in a row before it alerts (`[engine] eval`
is 30 s in `hw serve`, one run per `hw collect`), and a check that fails again within the cooldown
of its last alert is not re-announced. Secrets can
come from env vars (`*_env` keys). `hw` warns if the config file is world-readable.
Systemd runs the service without your shell env: put env vars in the unit with
`systemctl --user edit hw-serve.service` (`Environment=...`) or just use the config file.

## Dashboard
![dashboard](docs/dashboard-1440.jpg)

Live via Server-Sent Events (`/events`, only changed results are pushed); the page falls back to
polling `/api/current` every 5 s if the stream drops and reconnects by itself. The header dot is
green when live, amber when polling. API endpoints read the engine's in-memory cache, so they
answer in milliseconds. KPI tiles open a 1h/6h/24h/7d chart; healthy sections collapse to one line.
Phone layout: `docs/dashboard-390.jpg`.

Endpoints: `/`, `/events`, `/api/current`, `/api/history?hours=24`, `/api/fixlog`.
Actions (`POST /api/fix|check|test-alert|mute`) are localhost-only and need the `X-HW-Token`
header = `[remediation] token` (`hw init` generates one; the page asks for it once per tab). The
server looks up commands itself; it never runs anything the client sends. **Mute** (1h/24h, kept in
SQLite) keeps an issue on the page but stops its alerts and auto-fix. There is no other auth: keep
it on localhost, or use a reverse proxy / Tailscale.

## Self-heal (opt-in)
```toml
[remediation]
enabled = false          # off by default
mode = "dry-run"         # dry-run | ask | auto
fix_units = ["grafana-server.service"]
fix_containers = ["grafana"]
```
- `dry-run`: `hw collect` logs what it *would* run to `fix_log` (see `hw fix-log`, dashboard).
- `ask`: dashboard shows a **Fix** button per fixable issue. Needs `token` from config
  (`X-HW-Token`), and requests must come from localhost. CLI equivalent: `hw collect --fix`.
- `auto`: `hw collect` runs the fixes itself, re-checks, logs the result.

Allowlist (fixed templates; the unit/container must be in `fix_units`/`fix_containers` or mapped
by `fix_unit`/`fix_container` on a service check):
`systemctl --user restart <unit>` (failed user unit) or `sudo -n systemctl restart <unit>` (system
unit), `docker restart <name>`, and, only for a disk above `disk_crit`: `apt-get clean`,
`journalctl --vacuum-time=7d`, `docker image prune -f`. Anything else is refused.
Max 3 attempts per target per hour (dry-run logs a target at most once an hour); then it stops and sends one "needs a human" alert.

System-level fixes need a minimal sudoers rule, never blanket sudo
(`sudo visudo -f /etc/sudoers.d/homelab-watch`, replace `youruser` and the units):
```
youruser ALL=(root) NOPASSWD: /usr/bin/systemctl restart grafana-server.service, \
    /usr/bin/apt-get clean, /usr/bin/journalctl --vacuum-time=7d
```

## Tests
```bash
python3 -m unittest
```
