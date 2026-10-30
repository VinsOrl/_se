# homelab-watch pro

Small health monitor for a Linux box: CLI report, SQLite history, local dashboard, webhook
alerts, opt-in allowlisted self-heal. Python 3.11+, stdlib only, no CDN.

## Quickstart
```bash
cd homelab-watch
bin/hw report                # works with no config and no optional tools
bin/hw init                  # writes ~/.config/homelab-watch/config.toml (chmod 600)
bin/hw collect               # one sample into ~/.local/share/homelab-watch/history.db
bin/hw serve                 # http://127.0.0.1:8765  (also: python3 -m hw serve)
bin/hw install-timer --serve # systemd *user* timer every 5 min (+ dashboard service)
bin/hw uninstall
```
`python3 -m hw ...` works from this directory too. Put `bin/` on your PATH (or symlink
`bin/hw`) to type just `hw`.

| Command | What |
|---|---|
| `hw report [-o f] [--format md\|json]` | full report |
| `hw check` | prints problems, exit 0/1/2 = ok/warn/crit |
| `hw collect [--alert] [--fix]` | sample + store; alert on state change; `--fix` applies remediation in `ask` mode |
| `hw serve [--host H] [--port P]` | dashboard, 127.0.0.1:8765 by default |
| `hw test-alert` | send a test message to all configured targets |
| `hw fix-log` | what the self-heal did / would do |
| `hw install-timer [--serve]`, `hw uninstall` | systemd user units |

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
check that fails again within the cooldown of its last alert is not re-announced. Secrets can
come from env vars (`*_env` keys). `hw` warns if the config file is world-readable.
Systemd runs the timer without your shell env: put env vars in the unit with
`systemctl --user edit hw-collect.service` (`Environment=...`) or just use the config file.

## Dashboard
Read-only, no auth: keep it on localhost, or put it behind a reverse proxy / Tailscale.
`/` page, `/api/current`, `/api/history?hours=24`, `/api/fixlog`. The only write is `POST
/api/fix` (see below), which is off unless `[remediation] mode = "ask"`.

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
Max 3 attempts per target per hour; then it stops and sends one "needs a human" alert.

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
