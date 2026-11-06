# HW2 Report (week2/): NQU Campus Portal

## Notes
- **Location.** The project lives in `week2/` (originally built as `hw2/`, then moved by you). Tests were re-run after the move and still pass.
- **`.github/workflows/week1-pages.yml`** shows as deleted in `git status`. I did not do this and did not commit it. Check whether you meant to delete it.
- **Uploaded proof images are stored but never served.** This is safest, but admins can't view them. Add an admin-only download route if you want that.

## What I built
- **Backend:** Express and `better-sqlite3` (`data.db`, created and seeded on first run). JWT auth, `bcryptjs` passwords, `multer` image upload (max 2 MB).
  - Routes: `courses.js`, `leave.js`, `grades.js`.
  - Business errors return a stable `code`, for example `COURSE_FULL`, `TIME_CONFLICT`, `CREDIT_CAP`. The frontend translates them.
- **Frontend:** vanilla SPA with hash routing and a beige theme.
  - Screens: login, courses (search, add and drop), timetable (Mon–Sun × 8 periods, total credits), leave (image preview, remove button, admin approve and reject), grades (semester dropdown, credit-weighted average).
  - Language: EN / 繁中 switcher with all text from two dictionaries, `Intl` date and number formatting, and a CJK font stack.
- **Seed data:** 3 users (2 students and `admin`, password `demo1234`), 12 courses with a deliberate conflict (CS101 and CS202) and a capacity-1 course (CS999), and grades for 112-1 to 115-1 in both languages.
- **Tests:**
  - `npm test` runs 13 API and i18n tests (`node:test` and supertest, temp DB).
  - `npm run test:e2e` runs 6 Playwright tests on a separate port with a temp DB.
- **README** has run and test steps and the demo accounts.

## Test results (final run, after all fixes)
- `npm test`: 13 pass, 0 fail.
- `npm run test:e2e`: 6 pass, 0 fail.

## Bugs found while testing
- `nav {display:flex}` overrode the `hidden` attribute, so the nav showed on the login screen. I fixed it with a `[hidden]` rule.
- Async page renders could finish out of order and show the wrong page. `route()` now discards stale renders.

## Code review (code-review-skill) and fixes
- **IME search bug (important).** The search box re-rendered on every `input` event, which breaks Chinese IME composition. Fixed: search now skips events during composition and runs on `compositionend`.
- **Upload check read the whole file.** The magic-byte check read the entire file (up to 2 MB) to check 4 bytes. Fixed: it now reads only 4 bytes.
- **Tests wrote into the real `uploads/`.** Fixed: `UPLOAD_DIR` env var, set to a temp dir in tests.
- **Messy credit-cap test setup.** Fixed.
- **No findings:** the SQL is fully parameterized, `LIKE` wildcards are escaped, all dynamic HTML goes through `esc()`, and enrolling is atomic because `better-sqlite3` is synchronous.

## Security audit (focused, not the full multi-agent workflow)
I did a focused review of auth, JWT secret handling, upload checks, access control and input validation. I did not run the full six-phase audit with its sandboxed agents and coverage ledger, because you listed specific areas.

| Area | Result |
|---|---|
| **Auth** | bcrypt hashing. Login compares against a dummy hash for unknown IDs to equalize timing, and non-string input is rejected (400). **Fixed:** no brute-force limit, so there is now a 10-failures-per-15-minutes limit per IP (429). |
| **JWT** | Secret is read from `.env` only; `.env` is gitignored; the algorithm is pinned to HS256 (forged-secret and `alg:none` tokens are tested, 401); 8 h expiry. **Fixed:** a missing secret used to fail only at first login. The server now refuses to start without a secret of 16+ chars. |
| **Access control** | Role is re-read from the DB on each request, not trusted from the token. `PATCH /leave` is admin-only (tested 403). Leave and grades queries filter by the authenticated user, so there is no IDOR. |
| **Upload** | Image MIME whitelist, 2 MB limit, one file, a random UUID filename with an extension from our own map (the client filename is never used), and a magic-byte check so a fake `.png` is rejected. Files are never served statically. Bad files are deleted. |
| **Input validation** | Leave type, ISO dates, `from <= to` and reason length are checked; the semester is regex-checked; JSON body is limited to 10 KB. |
| **Headers (fixed)** | Added a CSP (`default-src 'self'; img-src 'self' data:`), `nosniff`, `X-Frame-Options: DENY` and no referrer. |

### Not fixed (accepted or out of scope)
- The login limiter is in-memory and per process. Behind a reverse proxy all clients would share one IP unless `trust proxy` is set.
- The JWT lives in `sessionStorage`, as the spec requires. It is exposed to XSS if one is ever introduced; the CSP and `esc()` mitigate this.
- No CSRF protection is needed, since auth is a bearer header and not a cookie.
- Demo accounts use a well-known password (`demo1234`). Remove the seed before any real deployment.
- Logout only clears the client token. JWTs are not revocable before they expire.

## Git
Committed to `main` as the configured repo owner (VinsOrl), with no Claude attribution lines.
