# NQU Campus Portal (HW2)

Express + SQLite + JWT + vanilla JS SPA, English / 繁體中文.

## Run
```
npm install
cp .env.example .env     # then set JWT_SECRET (command is in the file)
npm start                # http://localhost:3000
```
`data.db` is created and seeded on first run. The server refuses to log in anyone if `JWT_SECRET` is unset.

## Test
```
npm test                 # API + i18n unit checks (node:test + supertest, temp DB)
npx playwright install chromium   # once
npm run test:e2e         # Playwright, own server on :3101 and temp DB
```

## Demo accounts (password `demo1234`)
| Student ID | Role |
|---|---|
| 111210529 | student |
| 111210555 | student |
| admin | admin |
