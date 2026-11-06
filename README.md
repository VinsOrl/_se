# week1 · miniCurl

A **curl-style** command-line HTTP client, written in **Rust**, compiled to
**WebAssembly**, and running **entirely inside your browser** — hosted as a
static site on GitHub Pages.

Type real curl-ish commands at the prompt:

```
minicurl> https://httpbin.org/post -d "name=lin&course=SE115" -H "X-Week: 1"
```

Live: <https://vinsorl.github.io/_se/week1/>

## Try these

```sh
https://httpbin.org/get -v
https://httpbin.org/post -d "name=lin&course=SE115"
https://httpbin.org/headers -H "X-Week: 1" -H "X-Lang: Rust"
https://httpbin.org/status/404 -s
https://httpbin.org/get --max-time 2
https://httpbin.org/image/png -o image.png
https://httpbin.org/redirect/2 -L
```

## Supported flags

| Flag | Meaning |
|---|---|
| `-X, --request <METHOD>` | Override the method (GET / POST / PUT / DELETE / HEAD / PATCH / OPTIONS) |
| `-H, --header <Name: value>` | Add a request header (repeatable) |
| `-d, --data <body>` | Request body (implies POST unless `-X` is given; curl sends `application/x-www-form-urlencoded` by default) |
| `-o, --output <file>` | Save the response body as a browser download; `-o -` prints it in place |
| `-s, --silent` | Quiet |
| `-v, --verbose` | Show request line and response headers, like `curl -v` |
| `-L, --location` | Follow redirects (default is curl's: show the 3xx and stop) |
| `--max-time <sec>` | Abort the request after N seconds (floats allowed, `--max-time=0.5`) |

The command parser is hand-rolled (no clap) — single quotes, double quotes,
`--flag=value`, and curl's flag aliases all work.

## How it works

```
index.html ── app.js ── minicurl.wasm (compiled from src/)
                                │
                src/lib.rs      │        src/web.rs
                parse() ────────┴──────── send() ── fetch() ──▶ the internet
              (pure Rust,       (RequestSpec)    (WASM layer,
               unit-tested)                            browser APIs)
```

- `src/lib.rs` — pure Rust: tokenizes the command line and builds a
  `RequestSpec`. No web dependencies, so it runs natively under `cargo test`.
- `src/web.rs` — the only WASM code: converts the spec into a `fetch()` call
  (`redirect: "manual"` unless `-L`, `AbortSignal.timeout` for `--max-time`,
  Blob download for `-o`) and formats the response the way `curl` prints it.
- `index.html` + `app.js` — a ~150-line terminal UI: prompt, output pane,
  clickable examples, ↑/↓ history. No framework.

## Tests

```sh
cd week1
cargo test
```

Covers the parser: defaults, `-X` validation, `-d` ⇒ POST, repeated `-H`,
`--max-time` (float + `=` form), `-o -`, unknown flags, missing URL, quotes.

## Known limitations (honest ones)

- **CORS** — this is a browser, so cross-origin requests only work when the
  remote server allows it. `httpbin.org` does (`Access-Control-Allow-Origin: *`);
  most real sites don't. That is a browser security rule, not a bug in miniCurl.
- Redirects without `-L` are opaque cross-origin (the browser hides 3xx
  headers), so you may see a status without a `Location`.
- One URL per command. No multipart (`-F`), auth (`-u`), or proxy support —
  the week-1 core flag set, nothing speculative.
- Binary bodies print as `[N bytes of binary data]` unless you use `-o`.

## Local development

```sh
# one-time
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

cd week1
cargo test   # native parser tests
cargo build --release --target wasm32-unknown-unknown
npx --yes @wasm-tool/wasm-bindgen --target web --out-dir pkg \
  target/wasm32-unknown-unknown/release/minicurl.wasm

python3 -m http.server 8080   # open http://localhost:8080
```

## CI / GitHub Pages

`.github/workflows/week1-pages.yml` runs on every push touching `week1/`:

1. `cargo test` (native)
2. `cargo build --target wasm32-unknown-unknown`
3. `wasm-bindgen` (version pinned to `Cargo.lock`) → `pkg/`
4. publish `week1/` to the `gh-pages` branch →
   `https://vinsorl.github.io/_se/week1/`
