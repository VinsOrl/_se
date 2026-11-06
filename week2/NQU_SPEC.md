# NQU Campus Portal — Spec (HW2)

A simplified National Quemoy University (NQU) administrative system. Full-stack, with auth and tests. **Keep it simple. No over-engineering.**

## Stack
- Backend: Node.js + Express
- DB: SQLite via `better-sqlite3` (single file `data.db`, created + seeded on first run)
- Auth: JWT (`jsonwebtoken`), passwords hashed with `bcryptjs`
- Upload: `multer` (images only, max 2 MB, saved to `uploads/`)
- Frontend: vanilla HTML/CSS/JS, single-page app (hash routing), beige/cream theme
- Tests: `node:test` + `supertest` (API), Playwright (e2e)
- Config: `.env` (`JWT_SECRET`, `PORT`), with `.env.example`

## Folder layout
```
hw2/
  server.js            # start server
  src/app.js           # express app (exported for tests)
  src/db.js            # schema + seed
  src/auth.js          # login route + auth middleware
  src/routes/          # courses.js, leave.js, grades.js
  public/              # index.html, app.js, i18n.js, style.css
  tests/api/           # supertest tests
  tests/e2e/           # playwright tests
  README.md
  REPORT.md            # written by Claude Code (see rules)
```

## Multilingual (English + Traditional Chinese 繁體中文)
- Language switcher (EN / 繁中) in the header and on the login screen; choice saved in `localStorage`; default follows `navigator.language` (zh-* → 繁中, else EN).
- All UI text comes from two dictionaries in `public/i18n.js` (`en`, `zh-TW`), looked up by key via `t('key')`. No hard-coded UI strings elsewhere. Elements use `data-i18n` attributes; switching re-renders instantly without a page reload.
- Backend API errors return a stable `code` (e.g. `COURSE_FULL`, `TIME_CONFLICT`); the frontend translates the code. Don't translate on the server.
- Seed data stores both names: `courses.name_en` / `courses.name_zh`, `courses.teacher_en` / `teacher_zh`, `grades.course_name_en` / `course_name_zh`. API returns both; the UI picks by current language.
- Leave types and statuses are stored as codes (`sick`, `personal`, `official`, `other`; `pending`, `approved`, `rejected`) and translated in the UI.
- Dates and numbers format with `Intl` using the current language.
- Make sure the CJK font renders well (system font stack with `"Noto Sans TC", "Microsoft JhengHei", sans-serif`).

## Data model
- `users(id, student_id UNIQUE, name, password_hash, role)` — role: `student` | `admin`
- `courses(id, code, name, teacher, credits, day 1-7, start_period 1-8, periods, capacity)`
- `enrollments(id, user_id, course_id, UNIQUE(user_id, course_id))`
- `leave_requests(id, user_id, type, date_from, date_to, reason, file_path, status DEFAULT 'pending', created_at)`
- `grades(id, user_id, semester, course_name, credits, score)` — semester like `112-1` … `115-1`

Seed: 2 students (e.g. `111210529` / `111210555`, demo password), 1 admin, ~12 courses with varied times (include two that conflict), grades for 112-1 to 115-1.

## Features

### 1. Login / logout
- Login with student ID + password → JWT stored in `sessionStorage`.
- Three screens: login, main system, logout (clears token + form, back to login).
- Wrong credentials → clear error message.

### 2. Course enrollment + timetable
- List courses with search (name/code/teacher) and enrolled/full status.
- Add (加選) / drop (退選).
- Add rules, each returns a clear error: already enrolled, course full, **time conflict** with an enrolled course, **credit cap 25**.
- "My timetable": grid Mon–Sun × 8 periods, enrolled courses filled in, total credits shown, updates immediately after add/drop.

### 3. Leave request + file upload
- Form: type (病假/事假/公假/其他), date range, reason, optional image proof.
- Client-side preview with `FileReader`, with a remove button to clear and re-pick.
- Submit → saved as `pending`. Student sees own request list with status.
- Admin can list all requests and approve/reject.

### 4. Grade query
- Dropdown of semesters 112-1 … 115-1 → table of courses/credits/scores + semester GPA-style average.

## API (all except login need `Authorization: Bearer <jwt>`)
- `POST /api/login`
- `GET /api/courses?q=`
- `GET /api/my-courses`
- `POST /api/enroll/:courseId` · `DELETE /api/enroll/:courseId`
- `POST /api/leave` (multipart) · `GET /api/leave`
- `PATCH /api/leave/:id` (admin only: `approved` | `rejected`)
- `GET /api/grades?semester=`

Students only ever see their own data. Admin-only routes return 403 for students.

## Tests
**API (supertest):** login ok/fail; no token → 401; enroll success; duplicate; full course; time conflict; credit cap; drop; leave create + non-image rejected; student can't PATCH leave (403); grades only own.
**E2E (Playwright):** login → add course → appears on timetable → drop → logout; leave form with image preview and remove; grade dropdown switches semester.
**i18n:** e2e checks that switching EN ↔ 繁中 changes labels and persists after reload; a unit check that `en` and `zh-TW` dictionaries have exactly the same keys; API errors return `code`.
Tests use a separate temp DB (not `data.db`).

## Done when
- `npm install && npm start` runs it at `http://localhost:3000`
- `npm test` passes (API) and `npm run test:e2e` passes
- Every screen works fully in both English and 繁體中文
- README has run + test steps and demo accounts
