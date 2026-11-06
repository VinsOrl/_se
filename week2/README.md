# NQU Campus Portal

A small student portal for a university, in the style of National Quemoy University's admin system. Students can pick courses, see their timetable, ask for leave (with a photo as proof) and look up grades. Admins approve leave and manage accounts. The whole thing works in English and Traditional Chinese (繁體中文).

It was built for HW2 and the goal was to keep it simple: one Express server, one SQLite file, and a plain HTML/JS front end with no build step.

## Quick start

You need Node.js 20 or newer.

```bash
npm install
cp .env.example .env
```

Open `.env` and give `JWT_SECRET` a long random value. This one-liner makes one for you:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then start it:

```bash
npm start
```

Go to <http://localhost:3000>. The first run creates `data.db` and fills it with demo data. If you ever want a clean slate, stop the server and delete `data.db` (and the `uploads/` folder).

The server will refuse to start if `JWT_SECRET` is missing or shorter than 16 characters. That's on purpose: a forgotten secret should be a loud error, not a quietly insecure app.

### Demo accounts

Every demo account uses the password `demo1234`.

| Student ID  | Role    |
|-------------|---------|
| `111210529` | student |
| `111210555` | student |
| `admin`     | admin   |

You can also register a brand new student from the login screen.

## What you can do

**Log in and out.** Log in with a student ID and password. The token lives in `sessionStorage`, so closing the tab logs you out. The Log out button clears the token and the form.

**Register.** Anyone can create a student account from the login screen. The ID is 3–20 letters or digits and the password is at least 8 characters. Self-registration can only ever create students; there is no way to sign yourself up as an admin.

**Courses.** Browse and search by name, code or teacher (works in both English and Chinese). Add or drop a course. Adding fails with a clear message if:
- you're already enrolled,
- the course is full,
- it clashes in time with a course you already have, or
- it would push you over 25 credits.

**Timetable.** A Monday–Sunday by 8-period grid showing your courses and your total credits. It updates the moment you add or drop.

**Leave requests.** Pick a type (sick, personal, official, other), a date range, a reason, and optionally a proof image. You get a preview of the image before sending, with a button to remove it and pick another. After you submit, the request shows up as *pending*. Admins see everyone's requests and can approve or reject them.

**Grades.** Choose a semester from 112-1 to 115-1 and see your courses, credits and scores, plus a credit-weighted average.

**Admin: Users tab.** Admins can create student or admin accounts, see all accounts, and delete one. Deleting an account also removes that person's enrollments, leave requests, uploaded images and grades. You can't delete yourself, so there's always at least one admin. Delete is a two-click button ("Delete", then "Confirm delete?") so nobody removes an account by accident.

**Language.** Switch between EN and 繁中 in the header or on the login screen. Your choice is remembered, and the first visit follows your browser language. Switching is instant, with no page reload. Dates and numbers are formatted for the chosen language.

### Seed data worth knowing about

- 12 courses. `CS101` and `CS202` deliberately overlap on Monday, so you can see the time-conflict error.
- `CS999` has a capacity of 1, so you can see the "course full" error by enrolling a second student.
- Both demo students have grades for every semester from 112-1 to 115-1.

## How it's put together

```
server.js              starts the server (reads .env)
src/
  app.js               builds the Express app (also used by the tests)
  db.js                creates the tables and seeds demo data
  auth.js              login, register, rate limiting, JWT checks
  routes/
    courses.js         list, my courses, enroll, drop
    leave.js           create / list / approve leave, image upload
    grades.js          grades by semester
    users.js           admin: list, create, delete accounts
public/
  index.html           the single page
  app.js               hash-routing and all screens
  i18n.js              the English and 繁中 dictionaries
  style.css            beige / cream theme
tests/
  api/                 API tests (node:test + supertest)
  e2e/                 browser tests (Playwright)
```

Tech: Node + Express, SQLite through `better-sqlite3`, `jsonwebtoken` and `bcryptjs` for auth, `multer` for uploads. The front end is vanilla JavaScript.

### API

Everything except `login` and `register` needs an `Authorization: Bearer <token>` header. All errors come back as `{ "code": "SOMETHING" }`; the server never sends translated text, and the front end turns each code into a message in the current language.

| Method & path | Who | What it does |
|---|---|---|
| `POST /api/login` | anyone | Returns a token and the user |
| `POST /api/register` | anyone | Creates a student account |
| `GET /api/courses?q=` | logged in | Lists/searches courses |
| `GET /api/my-courses` | logged in | Your enrolled courses |
| `POST /api/enroll/:courseId` | logged in | Add a course |
| `DELETE /api/enroll/:courseId` | logged in | Drop a course |
| `POST /api/leave` | logged in | New leave request (multipart, optional image) |
| `GET /api/leave` | logged in | Your requests (admins see everyone's) |
| `PATCH /api/leave/:id` | admin | Set `approved` or `rejected` |
| `GET /api/grades?semester=` | logged in | Your grades and average for a semester |
| `GET /api/users` | admin | List accounts |
| `POST /api/users` | admin | Create a student or admin |
| `DELETE /api/users/:id` | admin | Delete an account and its data |

Students only ever see their own data, and admin routes return 403 for students.

### Error codes

`INVALID_CREDENTIALS`, `UNAUTHORIZED`, `FORBIDDEN`, `ALREADY_ENROLLED`, `COURSE_FULL`, `TIME_CONFLICT`, `CREDIT_CAP`, `INVALID_INPUT`, `INVALID_FILE`, `FILE_TOO_LARGE`, `COURSE_NOT_FOUND`, `NOT_ENROLLED`, `NOT_FOUND`, `STUDENT_ID_TAKEN`, `CANNOT_DELETE_SELF`, `USER_NOT_FOUND`, `TOO_MANY_ATTEMPTS`, `SERVER_ERROR`.

A test checks that every one of these has a translation in both languages.

## Running the tests

```bash
npm test                          # API + translation checks
npx playwright install chromium   # one time only
npm run test:e2e                  # real browser tests
```

- The API tests use a temporary database and upload folder, so they never touch your `data.db`.
- The browser tests start their own server on port 3101 with a temporary database. You don't need to start anything first.
- One test makes sure the English and 繁中 dictionaries have exactly the same keys, so a missing translation fails the build.

## Security notes

Things that are handled:
- Passwords are hashed with bcrypt. Unknown users take the same time to reject as wrong passwords, so login doesn't reveal which IDs exist.
- JWTs are signed with your secret, pinned to HS256 and expire after 8 hours. The user and role are re-read from the database on every request, so a deleted user's token stops working immediately and nobody can promote themselves by editing a token.
- Login and register are rate limited (10 attempts per IP per 15 minutes).
- Uploads: images only (PNG, JPG, GIF, WebP), max 2 MB. The file's real contents are checked, not just its name or type, and it's saved under a random name. Uploaded files are not served back over the web.
- Every database query is parameterized, everything shown on screen is escaped, and the server sends a Content-Security-Policy and other protective headers.

Things to know about:
- The rate limiter lives in memory, so it resets when the server restarts. Behind a reverse proxy, every visitor would look like the same IP unless you configure Express's `trust proxy`.
- There's no password reset or email verification.
- Logging out only clears the token in the browser; a stolen token stays valid until it expires.
- The demo accounts share a well-known password. Remove the seed data before putting this anywhere real.

## Optional settings

These go in `.env` (or the environment). Only `JWT_SECRET` is required.

| Variable | Default | Meaning |
|---|---|---|
| `JWT_SECRET` | none, required | Secret for signing tokens, 16+ characters |
| `PORT` | `3000` | Port to listen on |
| `DB_FILE` | `data.db` | SQLite file path |
| `UPLOAD_DIR` | `uploads/` | Where leave images are stored |

## Known limitations

- Admins can't view the uploaded proof images yet. They're stored but not served; an admin-only download route would be the next step.
- It's a demo-sized system: no pagination, no editing of accounts, and no waitlists.
