# Week 6 — Docker Usage

A small **microservice system** built with Docker and Docker Compose, plus notes on what I learned about Docker along the way.

| Service | Tech | Role |
|---------|------|------|
| `nginx` | nginx 1.27 | Web server (serves the UI) and **reverse proxy** — the only public entry point |
| `api` | Node.js 22 + Express | REST API for notes, talks to PostgreSQL |
| `db` | PostgreSQL 16 | Database, data kept in a named volume |
| `python` | Python 3.12 (stdlib only) | Small info/health microservice |
| `rust` | Rust (multi-stage build) | CPU-heavy microservice (prime sieve) |

The web UI (served by nginx) shows the live status of every service, lets you add/delete notes stored in PostgreSQL, and asks the Rust container to compute primes.

---

## 1. Architecture

```
                         ┌──────────── frontend network ────────────┐
                         │                                          │
 browser ──► :8080 ──► [ nginx ] ──/api/*──► [ api (Node.js) ]───┐  │
                         │   │                                    │  │
                         │   ├──/py/*───► [ python ]              │  │
                         │   └──/rs/*───► [ rust ]                │  │
                         └────────────────────────────────────────┼──┘
                                                                  │
                         ┌──────────── backend network ───────────┼──┐
                         │                                        ▼  │
                         │                              [ db (PostgreSQL) ]
                         │                                        │  │
                         └────────────────────────────────────────┼──┘
                                                          volume: pgdata
```

Design decisions:

- **Only nginx publishes a port** (`8080` on the host). Every other container is reachable only inside Docker networks.
- **Two networks.** `db` lives only on `backend`, so nginx, Python, and Rust cannot talk to the database at all — only the API can.
- **Service-name DNS.** Containers find each other by service name (`db`, `api`, `python`, `rust`), not by IP.
- **Data survives restarts** thanks to the `pgdata` named volume.

## 2. Project structure

```
week6/
├── docker-compose.yml        # defines all services, networks, volumes
├── .env.example              # optional overrides (ports, DB credentials)
├── nginx/
│   ├── Dockerfile
│   ├── nginx.conf            # reverse-proxy rules
│   └── html/index.html       # the web interface
├── api/                      # Node.js + Express
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
├── python/
│   ├── Dockerfile
│   └── app.py
├── rust/
│   ├── Dockerfile            # multi-stage build
│   ├── Cargo.toml
│   └── src/main.rs
└── db/
    └── init.sql              # creates the notes table on first start
```

## 3. Quick start

Requirements: Docker Engine + the Compose plugin (`docker compose version`).

```bash
cd week6

# (optional) change the port or DB password
cp .env.example .env

# build all images and start everything in the background
docker compose up -d --build

# check that all containers are up / healthy
docker compose ps
```

Then open **http://localhost:8080**.

Stop it:

```bash
docker compose down        # stop and remove containers (data is kept)
docker compose down -v     # ...and also delete the database volume
```

### Try the endpoints from the terminal

```bash
curl http://localhost:8080/api/health            # Node API + PostgreSQL version
curl http://localhost:8080/api/notes             # list notes
curl -X POST http://localhost:8080/api/notes \
     -H 'Content-Type: application/json' \
     -d '{"content":"hello docker"}'             # add a note
curl http://localhost:8080/py/health             # Python service
curl http://localhost:8080/rs/health             # Rust service
curl "http://localhost:8080/rs/primes?n=5000000" # Rust: count primes <= 5,000,000
```

### Prove the data really persists

```bash
docker compose restart db        # or: docker compose down && docker compose up -d
curl http://localhost:8080/api/notes   # your notes are still there
```

## 4. How each Dockerfile works

### `api/Dockerfile` (Node.js)

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./            # 1) copy only the manifests...
RUN npm install --omit=dev       # 2) ...so this slow layer is cached
COPY server.js ./                # 3) code changes don't re-install dependencies
USER node                        # run as non-root
CMD ["node", "server.js"]
```

The key idea is **layer caching**: Docker re-uses a layer until something above it changes. Putting `COPY package*.json` before `COPY server.js` means editing code doesn't trigger a full `npm install`.

### `rust/Dockerfile` (multi-stage build)

```dockerfile
FROM rust:1.82-slim AS builder   # big image with the compiler
RUN cargo build --release

FROM debian:bookworm-slim        # small runtime image
COPY --from=builder /build/target/release/rust-service /usr/local/bin/
```

The Rust toolchain is large (hundreds of MB). A **multi-stage build** compiles in the first stage and copies only the finished binary into a tiny final image, so what we ship is small and has no compiler in it.

### `python/Dockerfile`

A slim base image, `PYTHONUNBUFFERED=1` so logs show up instantly in `docker logs`, and a non-root user. The service uses only the standard library, so there is no `pip install` step.

### `nginx/Dockerfile`

Starts from `nginx:alpine`, removes the default site, and copies in our `nginx.conf` and the static `html/` folder.

## 5. How docker-compose.yml works

| Feature | Where | Why |
|---------|-------|-----|
| `build:` | api, python, rust, nginx | Build the image from the folder's Dockerfile |
| `image:` | db | Use the official `postgres:16-alpine` image directly |
| `ports:` | nginx only | Publish container port 80 to host port 8080 |
| `environment:` | api, db | Configuration via env vars (12-factor style) |
| `volumes:` | db | `pgdata` named volume for persistence; `init.sql` mounted into `/docker-entrypoint-initdb.d/` so the table is created on first start |
| `networks:` | all | `frontend` and `backend` isolation |
| `healthcheck:` | db, api | `pg_isready` for Postgres; HTTP check for the API |
| `depends_on: condition: service_healthy` | api, nginx | Start in the right order **and wait until ready**, not just started |
| `restart: unless-stopped` | all | Auto-restart after crashes or reboots |

Values like `${POSTGRES_PASSWORD:-apppass}` read from your `.env` file and fall back to a default.

### nginx reverse proxy rules (`nginx/nginx.conf`)

| URL | Goes to | Prefix handling |
|-----|---------|-----------------|
| `/` | static files in `/usr/share/nginx/html` | — |
| `/api/...` | `http://api:3000` | kept (`/api/notes` → `/api/notes`) |
| `/py/...` | `http://python:5000/` | stripped (`/py/health` → `/health`) |
| `/rs/...` | `http://rust:8000/` | stripped (`/rs/health` → `/health`) |

The trailing slash in `proxy_pass http://python:5000/;` is what makes nginx strip the `/py/` prefix. Without it the prefix is passed through.

## 6. Docker command cheat sheet

```bash
# --- Compose (day-to-day) ---
docker compose up -d --build      # build + start
docker compose ps                 # status
docker compose logs -f api        # follow one service's logs
docker compose exec db psql -U appuser -d appdb   # open a SQL shell
docker compose exec api sh        # shell inside a running container
docker compose restart api        # restart one service
docker compose build --no-cache   # rebuild without cache
docker compose down -v            # tear everything down, including volumes

# --- Plain Docker ---
docker images                     # list images
docker ps -a                      # all containers
docker logs -f <name>             # logs
docker network ls                 # networks
docker volume ls                  # volumes
docker system prune               # delete unused stuff
```

Useful SQL check:

```bash
docker compose exec db psql -U appuser -d appdb -c "SELECT * FROM notes;"
```

## 7. What I learned

- **Image vs container.** An image is the template, a container is a running instance. I can delete and recreate containers freely; only volumes keep data.
- **Layer caching matters.** Ordering Dockerfile instructions from "changes rarely" to "changes often" makes rebuilds fast.
- **Multi-stage builds** keep compiled-language images small (Rust here).
- **Containers talk by service name** on a shared network. `localhost` inside a container means *that container*, not the host and not other services — the API connects to host `db`, not `localhost`.
- **`depends_on` alone only waits for "started".** Postgres needs a few seconds to accept connections, so a `healthcheck` plus `condition: service_healthy` avoids "connection refused" on startup.
- **`init.sql` only runs once**, when the data volume is first created. If I change it later I have to run `docker compose down -v` to re-initialize.
- **Publish as few ports as possible.** Only nginx is exposed; the database is not reachable from the host or from the other app containers.
- **Don't run as root** in containers if you can avoid it (`USER node`, a dedicated user for Python and Rust).
- **Reverse proxy = one entry point.** The browser only ever talks to `:8080`; nginx routes by URL path, which also avoids CORS problems.

## 8. Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| `port is already allocated` | Port 8080 is in use. Set `WEB_PORT=8081` in `.env` |
| `permission denied ... docker.sock` | Add your user to the `docker` group, then log out and in: `sudo usermod -aG docker $USER` |
| API shows `db-error` | DB still starting or wrong credentials. Check `docker compose logs db api`. If you changed the password after the first run, use `docker compose down -v` |
| `502 Bad Gateway` from nginx | The upstream container crashed. `docker compose ps` and `docker compose logs <service>` |
| Changed code, nothing changed | Rebuild: `docker compose up -d --build` |
| First Rust build is slow | Normal — it compiles in release mode; later builds are cached |
| Disk filling up | `docker system prune` (add `-a` to also remove unused images) |

## 9. Ideas to extend

- Add `docker-compose.override.yml` with bind mounts and `nodemon` for live-reload development.
- Add a Redis container as a cache in front of the notes query.
- Put TLS in front of nginx (Let's Encrypt / certbot container).
- Run the same stack on an AWS EC2 instance (install Docker, `docker compose up -d`).
