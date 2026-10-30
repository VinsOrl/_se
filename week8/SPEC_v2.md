# homelab-watch v2: Live engine + dashboard redesign

Builds on the finished v1 in `week8/homelab-watch/` (see its REPORT.md). Keep it SIMPLE: stdlib only, no JS/CSS libraries, no CDN, no websockets.

## Working rules (read first)
- **Use the `/ponytail` skill for all coding.** If it is not available in this session, say so at the top of REPORT.md and continue normally.
- **After every phase, run the `/code-review-skill` skill on that phase's changes.** Fix everything it marks blocking/important, and list its findings and what you fixed in REPORT.md.
- Git: commits authored as me (GitHub: VinsOrl). NO Co-Authored-By, NO Claude/AI attribution anywhere. One commit per phase (review fixes can be a second commit).
- Put the report, decisions, and questions in `REPORT.md` (append a "v2" section). Text replies: 1-2 lines telling me to read it.
- If something is unclear, pick the simplest option, write it in REPORT.md, keep going.

## Phase 0: leftovers from v1 feedback (small)
- Exited containers with exit code 0 no longer warn. Warn on non-zero exit, restarting, or unhealthy. Add `ignore_containers` to config.
- Flap protection: a check must be bad for N consecutive samples before it alerts (config, default 2). Applies to temperatures especially (my sensors sit at 78-79C, close to thresholds).
- Skip anything here that REPORT.md already says is done.

## Phase 7: Live engine (`hw serve` does everything by itself)
Goal: I run ONE process (`hw serve`) and everything happens live. No `hw collect`, no timer needed.

- Background scheduler threads inside `hw serve`, three tiers (intervals in config):
  - **Fast (2s):** CPU %, load, RAM/swap, temperatures, GPU, network rx/tx rate.
  - **Medium (30s):** disks, Docker, failed systemd units, ping/DNS/HTTP/TCP checks, top processes.
  - **Slow (10 min):** apt updates, reboot-required, backup age.
- One shared in-memory snapshot. API endpoints read the cache and **never run collection per request** (v1 took 1-3 s per request).
- Each tick evaluates statuses, then runs alerts (with flap protection + cooldown) and remediation (per `[remediation]` mode) exactly as before.
- History is written to SQLite every 60s, with retention pruning.
- **Live push to the browser:** `GET /events` Server-Sent Events (use `ThreadingHTTPServer`), sending the changed parts of the snapshot. Browser falls back to polling `/api/current` every 5s if SSE drops, and auto-reconnects.
- **Live actions from the page** (same rules as v1: localhost-only + `X-HW-Token`; server looks up the command itself, never takes a command from the client):
  - Fix (existing allowlist), Run check now, Send test alert, Mute an issue for 1h / 24h (stored in SQLite; muted issues still show but don't alert or auto-fix).
- `hw install-service` installs `hw serve` as a **systemd user service** (restart on failure) and is now the recommended setup. Keep `hw collect` / `install-timer` as a headless fallback, but `collect --alert` must exit early if a `hw serve` process is running (lock file) so alerts never double-send.
- Graceful shutdown (SIGTERM) and one crashing collector must never kill the loop: catch, log, mark that section "unavailable", keep going.

## Phase 8: Dashboard redesign
Problems with the current page (from my screenshot): too dense and tiny text, 5 equal columns with big empty areas, every sensor and container listed with a green check (noise), sparklines have no scale or time axis, a wall of log text, an empty Fix log card, emoji-heavy.

Redesign (single embedded page, inline CSS/JS, update the DOM in place so nothing flickers):
- **Top bar:** hostname, large overall status pill (OK / N warnings / Critical), live indicator dot (pulses green when SSE is connected, amber when stale/polling), uptime, theme toggle.
- **KPI row:** CPU, RAM, Disk (max), Temp (max), GPU. Each tile: big number, thin progress bar/gauge colored by status, 24h sparkline with min/max labels and a hover tooltip (value + time). Clicking a tile opens a larger chart with a range switch 1h / 6h / 24h / 7d.
- **"Needs attention" panel first:** one card per issue (severity color, short title, 1-line detail, buttons: Fix / Mute / Details). If none: a calm "All systems normal".
- **Sections as collapsible cards** that show a one-line summary when healthy (e.g. "Docker: 9 running, 1 exited"). Only abnormal items are listed by default, with a "show all" toggle. Temperatures: hottest 3 + expand. Failed-unit logs: collapsed monospace block, last 5 lines, copy button.
- **Fix log** as a timeline in a drawer/tab, hidden when empty.
- **Layout/typography:** max-width ~1400px, 2 columns on laptop, 1 column on phone (390px), base font 15-16px, tabular numbers, consistent spacing, proper status colors with SVG icons (no emoji), dark by default, light theme via `prefers-color-scheme` + toggle, readable contrast.

## Acceptance checklist
- [ ] Only `hw serve` is running; with no timer and no `hw collect`, values update live (about every 2s for fast metrics), history grows, alerts and remediation still work
- [ ] `/api/current` responds fast (cached), including with several browser tabs open
- [ ] Kill the network or stop SSE: page falls back to polling and recovers by itself
- [ ] Fix / Run check / Test alert / Mute work from the page; a muted issue doesn't alert
- [ ] A collector that crashes or a missing tool never takes the server down
- [ ] `hw collect --alert` does nothing while `hw serve` is running
- [ ] Page checked in a real browser at 1440px and 390px wide; screenshots saved to `docs/` and mentioned in REPORT.md; no console errors
- [ ] Tests updated and passing; `/code-review-skill` run per phase and findings logged in REPORT.md
- [ ] README updated: quickstart is now `hw init` -> edit config -> `hw install-service`
