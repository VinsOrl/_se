# Week 7 — A Todo App, and Three Ways to Prove It Works

This is a small todo-list web app. You type something you need to do, hit **Add**, tick it off when it's done, filter by what's left, and clear out the finished stuff.

The app itself is deliberately simple. The real point of this project is the **testing**: the same app is checked at three different levels — unit tests, system (API) tests, and end-to-end browser tests — so you can see what each kind of test is good at and why you'd want all three.

---

## Table of contents

1. [What the app does](#what-the-app-does)
2. [Quick start](#quick-start)
3. [How it's put together](#how-its-put-together)
4. [The API, with examples](#the-api-with-examples)
5. [The three kinds of tests](#the-three-kinds-of-tests)
6. [Running the tests](#running-the-tests)
7. [Design decisions (and why)](#design-decisions-and-why)
8. [Known limitations](#known-limitations)
9. [Troubleshooting](#troubleshooting)
10. [Project layout](#project-layout)

---

## What the app does

From the browser you can:

- **Add** a todo (the title is trimmed and extra spaces are squashed, so `"  buy   milk "` becomes `"buy milk"`).
- **Complete** a todo with its checkbox. Completed items get struck through.
- **Filter** the list by **All**, **Active**, or **Completed**.
- **Delete** a single todo.
- **Clear completed** to remove every finished todo in one go.
- See a live counter like *"2 items left"*.

If you try to add an empty todo, you get a friendly error message instead of a blank row. Titles can be 1–100 characters.

Your todos live on the **server**, not in the browser, so they survive a page refresh. (They do *not* survive restarting the server — see [Known limitations](#known-limitations).)

---

## Quick start

You need **Node.js 21 or newer** (it was built and tested on Node 22). The test scripts use glob patterns, which older versions of `node --test` do not support.

```bash
npm install
npm start
```

Then open <http://localhost:3000>. To use a different port:

```bash
PORT=8080 npm start
```

---

## How it's put together

The app has three layers. Each one does one job, and that separation is what makes it easy to test.

```
 Browser (public/)                Server (src/)
┌──────────────────┐   HTTP    ┌────────────────────────────────────┐
│ index.html       │  ──────▶  │ app.js        routes + error handling │
│ app.js  (UI)     │  ◀──────  │    │                                │
│ style.css        │   JSON    │    ▼                                │
└──────────────────┘           │ todoStore.js  the "business logic"  │
                               │    │                                │
                               │    ▼                                │
                               │ validation.js pure helper functions │
                               └────────────────────────────────────┘
```

**`src/validation.js` — the rules.**
Small pure functions: clean up a title, check it's a non-empty string under 100 characters, check a filter name is one of `all` / `active` / `completed`. No HTTP, no state. Give it an input, get an answer.

**`src/todoStore.js` — the brain.**
A `TodoStore` class that holds the todos in memory and knows how to add, list, get, update, remove, clear completed, and compute stats. It has no idea that HTTP exists. When something goes wrong it throws a `TodoError` with a code (`VALIDATION` or `NOT_FOUND`), and doesn't decide what the web response should look like.

**`src/app.js` — the front door.**
Builds the Express app. It translates HTTP requests into store calls and turns the results (or errors) into JSON responses with sensible status codes. `VALIDATION` errors become `400`, `NOT_FOUND` becomes `404`, anything unexpected becomes `500`. It's exported as a function, `createApp(store)`, so tests can hand it a fresh, empty store.

**`src/server.js` — the on switch.**
Just starts the app listening on a port. It only does so when run directly, so importing `app.js` in a test never accidentally opens a port.

**`public/` — the client.**
Plain HTML, CSS, and vanilla JavaScript. No framework, no build step. The page asks the API for todos, draws them, and calls the API again whenever you click something. The server is the single source of truth: after every change the client re-fetches and re-renders rather than trying to keep its own copy in sync.

---

## The API, with examples

All endpoints speak JSON under `/api`. Here they are with `curl` so you can poke at them yourself (start the server first).

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/api/health` | Is the server alive? Returns `{"status":"ok"}` |
| `GET` | `/api/stats` | Counts: `{ total, active, completed }` |
| `GET` | `/api/todos?status=all\|active\|completed` | List todos, optionally filtered |
| `POST` | `/api/todos` | Create one. Body: `{"title": "..."}`. Returns `201` |
| `GET` | `/api/todos/:id` | Get one todo |
| `PATCH` | `/api/todos/:id` | Change `title` and/or `completed` |
| `DELETE` | `/api/todos/:id` | Delete one. Returns `204` (no body) |
| `DELETE` | `/api/todos?completed=true` | Clear all completed. Returns `{"removed": N}` |

**Create a todo**

```bash
curl -i -X POST localhost:3000/api/todos \
  -H 'Content-Type: application/json' \
  -d '{"title":"Write the report"}'
```

You get back `201 Created`, a `Location: /api/todos/1` header, and:

```json
{ "id": 1, "title": "Write the report", "completed": false, "createdAt": "2026-10-23T03:30:00.000Z" }
```

**Mark it done**

```bash
curl -X PATCH localhost:3000/api/todos/1 \
  -H 'Content-Type: application/json' \
  -d '{"completed": true}'
```

**List only what's left**

```bash
curl 'localhost:3000/api/todos?status=active'
```

**What errors look like**

Errors always come back as JSON with an `error` message:

| Situation | Status | Example message |
| --- | --- | --- |
| Empty or too-long title | `400` | `title must not be empty` |
| Title isn't a string / `completed` isn't a boolean | `400` | `completed must be a boolean` |
| Malformed JSON body | `400` | `invalid JSON body` |
| Id isn't a number (`/api/todos/abc`) | `400` | `id must be a positive integer` |
| Unknown `status` filter | `400` | `status must be one of: all, active, completed` |
| `PATCH` with nothing to change | `400` | `provide title and/or completed` |
| Todo doesn't exist | `404` | `todo 99 not found` |
| Unknown `/api/...` route | `404` | `not found` |

---

## The three kinds of tests

Think of the three levels like checking a car. You can test the engine parts on a bench, test the assembled car on a test track, or have a person actually drive it to the shops. Each catches different problems.

### 1. Unit tests — the parts on the bench
**Folder:** `tests/unit/` · **Tool:** Node's built-in `node:test` · **Count:** 17

These test the server's logic in complete isolation — no network, no browser, no Express. They call `validateTitle()` and `TodoStore` methods directly and check the results.

What they cover:
- Title cleaning, including odd inputs (`undefined`, numbers, `null`).
- The 100-character boundary (exactly 100 is fine, 101 is rejected).
- IDs increment, defaults are right, and filters return the right subsets.
- Errors are thrown with the correct code (`VALIDATION` vs `NOT_FOUND`).
- The store returns **copies**, so outside code can't secretly change its internal data.
- `clearCompleted` and `stats` give correct numbers.

They're the fastest tests (the whole group runs in about a tenth of a second) and when one fails, it points straight at the broken function.

The client is intentionally **not** unit-tested. The browser behaviour is covered by the e2e tests instead.

### 2. System tests — the car on the test track
**Folder:** `tests/system/` · **Tool:** `node:test` + built-in `fetch` · **Count:** 13

These start the **real server** on a random free port and talk to it over actual HTTP, exactly as any outside client (a phone app, `curl`, another service) would. No mocks.

What they cover:
- Every endpoint's happy path and the status codes (`201`, `204`, `200`).
- The `Location` header on creation.
- All the error cases from the table above, including malformed JSON.
- Filtering, bulk delete, and stats reflecting the current state.
- That the static page is served at `/`.

This is where we find out that the pieces *fit together* — for instance, that a `TodoError` thrown deep in the store really does turn into a clean `404` response.

### 3. End-to-end (e2e) tests — someone actually drives it
**Folder:** `tests/e2e/` · **Tool:** [Playwright](https://playwright.dev) with headless Chromium · **Count:** 8

These launch the server *and* a real (invisible) browser, then click and type like a person would.

What they cover:
- The page loads with an empty list and "0 items left".
- Adding a todo shows it and updates the counter.
- Submitting an empty title shows the validation error.
- Ticking a todo strikes it through and updates the counter.
- The All / Active / Completed filters show the right items.
- Deleting a todo, and "Clear completed".
- A todo is still there after reloading the page.

These are the slowest tests (a few seconds) but the only ones that prove the whole thing — HTML, JavaScript, API, and server — works together from a user's point of view. Playwright starts and stops the server for you (see `playwright.config.js`).

### Why bother with all three?

| If this breaks… | …this test level notices |
| --- | --- |
| A validation rule or store method | **Unit** (and tells you exactly where) |
| A route, status code, or error mapping | **System** |
| A button, the page's JavaScript, or how the UI talks to the API | **E2E** |

Lots of fast unit tests, a moderate number of system tests, and a few slower e2e tests is the classic "test pyramid" shape — cheap checks at the bottom, a few expensive ones at the top.

---

## Running the tests

```bash
npm test              # runs unit, then system, then e2e (stops at the first failing level)

npm run test:unit     # just unit tests
npm run test:system   # just system/API tests
npm run test:e2e      # just browser tests
```

**First time running e2e?** Playwright needs a Chromium browser:

```bash
npx playwright install chromium
```

Playwright is pinned to an exact version (`1.63.0`) in `package.json`. Playwright is strict about matching its own browser builds, so pinning avoids "browser not found" surprises on machines that already have a browser installed for that version. If you upgrade Playwright, re-run the install command above.

If an e2e test fails, Playwright keeps a trace in `test-results/`. Open it with:

```bash
npx playwright show-trace test-results/<test-folder>/trace.zip
```

---

## Design decisions (and why)

**Logic separated from HTTP.** The store and validators know nothing about Express. That's why the unit tests can be tiny and instant, and why it'd be easy to swap Express for something else later.

**`createApp(store)` instead of a global app.** Because the app is built by a function that accepts a store, each test suite can get its own fresh, empty one. No shared state leaking between test files.

**Errors as data with codes.** The store throws `TodoError('NOT_FOUND', …)` rather than HTTP status numbers. One central error handler in `app.js` decides how those map to responses, so the rule lives in exactly one place.

**Server is the source of truth.** The client never edits its own list and hopes it matches. It always re-fetches. Slightly more network chatter, but far fewer ways for the screen and the data to disagree.

**No frontend framework, no build step.** For an app this size, plain JavaScript is easier to read and has nothing extra to break. It also keeps the focus on testing.

**Safe rendering.** Todo titles are inserted with `textContent`, not `innerHTML`, so a todo like `<img src=x onerror=...>` is shown as plain text and can't run as code.

**Strict, explicit validation.** Bad input gets a clear `400` with a message, rather than being silently fixed or crashing. Ids must be whole numbers and `completed` must be a real boolean.

**E2E tests run one at a time.** They all share a single in-memory server, so running them in parallel would make them step on each other. Each test wipes the data through the API first so it starts clean.

---

## Known limitations

Being upfront about what this is *not*:

- **Data is in memory only.** Restart the server and every todo is gone. A real app would use a database (SQLite would be the natural next step — only `todoStore.js` would need to change).
- **No users or login.** Everyone who can reach the server shares one list.
- **No editing of titles in the UI.** The API supports renaming (`PATCH` with `title`), but the page doesn't have an edit control yet.
- **No pagination.** Fine for a personal list, not for thousands of items.
- **Client logic has no unit tests.** By design for this assignment; it's exercised through the e2e tests only.

---

## Troubleshooting

**`EADDRINUSE` / port already in use.** Something else is on that port. Use another: `PORT=3001 npm start`. (The e2e tests use port `3100`, so make sure that one is free too.)

**e2e: "Executable doesn't exist" / browser not found.** Run `npx playwright install chromium`. If it can't download (offline or behind a proxy), you need a Chromium build matching the pinned Playwright version.

**`node --test` finds no tests.** Make sure you're on Node 21+ and running through the npm scripts, which pass glob patterns like `tests/unit/**/*.test.js`.

**An e2e test fails only sometimes.** Check nothing else is talking to the test server on port `3100` while the tests run, since they assume they're the only client.

---

## Project layout

```
week7/
├── package.json            scripts and dependencies
├── playwright.config.js    e2e config: headless Chromium, auto-starts the server on :3100
├── src/
│   ├── validation.js       pure validation helpers
│   ├── todoStore.js        in-memory store + TodoError
│   ├── app.js              Express routes and error handling (createApp)
│   └── server.js           entry point (starts listening)
├── public/
│   ├── index.html          the page
│   ├── app.js              client-side behaviour
│   └── style.css           styling
└── tests/
    ├── unit/               validation + store tests (17)
    ├── system/             HTTP API tests (13)
    └── e2e/                Playwright browser tests (8)
```

**Totals:** 38 automated tests across the three levels, all passing.
