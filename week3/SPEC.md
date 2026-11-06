# Week 3 Spec: Quote & Invoice Generator (報價單／請款單產生器)

Assignment (Exercise 3): come up with a valuable project and implement it. Value = practical use or commercial. AI tools allowed.
Reference: https://github.com/ccc115a/_se/issues/5 (other students: fairshare, PasswordVault, readme-generator, ai-resume-checker. Do NOT duplicate those.)

## 1. Why this project (goes into README)

**Practical value**
- Am I the user? Yes: side jobs / freelance work need quotes and invoices; today I hand-edit Word files.
- Do many people want it? Freelancers, designers, tutors, photographers, small shops. Most have no accounting software.

**Commercial value**
- Freemium SaaS: free = this tool; paid (~NT$99/month) = logo/brand, client address book, history, cloud sync, e-mail sending, payment reminders.
- Commissionable: small businesses pay for a custom version (their template, item catalog, stamp) = one-off fee + hosting.
- Expansion: e-invoice (電子發票) integration, CSV export for accountant, LINE notification.

## 2. Scope (keep it SIMPLE, no over-engineering)

- Zero dependencies, no build step, no backend, no accounts. Open `index.html` and it works.
- Data stays in the browser (localStorage). Wrap storage access in try/catch.
- Output = print-ready page; user saves PDF via browser print.

## 3. Files (all inside `week3/`)

| File | Purpose |
|---|---|
| `index.html` | Layout + print CSS (form left, document preview right; print hides the form) |
| `app.js` | UI only: form, live preview, autosave, print button |
| `lib.js` | Pure logic, works in browser (`window.QI`) and Node (`module.exports`) |
| `test.js` | Unit tests using `node:test` (run: `node --test test.js`) |
| `README.md` | What it is, how to run/test, the value section from section 1 |
| `REPORT.md` | Written by Claude Code: what was done, test results, open questions |

## 4. Features

1. Type: quote (報價單) or invoice (請款單).
2. Fields: seller (name, tax ID, contact), client, date, items (name, qty, unit price), discount, note.
3. Tax modes: `none`, `exclusive` (add 5%), `inclusive` (5% inside the price).
4. Auto document number: `QT-YYYYMMDD-001` (quote) / `INV-YYYYMMDD-001` (invoice); sequence counts docs already printed that day for that type.
5. Total also shown in Chinese capital numerals (大寫金額), e.g. 壹萬零伍佰元整.
6. Autosave form on every input; "clear" button resets.
7. Validation on print: seller, client, and at least one item (name, qty > 0, price >= 0) required; show a red message, highlight empty fields.
8. Preview must escape user input (no HTML injection).
9. Default date must use the LOCAL date (user is in Asia/Taipei), not UTC `toISOString()`.

## 5. Logic rules for `lib.js`

- `calcTotals(items, taxMode, discount)` returns `{lines, sum, discount, subtotal, tax, total}`.
  - Bad/non-numeric qty/price count as 0.
  - Discount is clamped to `[0, sum]` and applied BEFORE tax.
  - `exclusive`: `tax = round(base * 0.05)`, `total = base + tax`.
  - `inclusive`: `subtotal = round(base / 1.05)`, `tax = base - subtotal`, `total = base`.
  - Money rounded to integers for tax, 2 decimals for line amounts.
- `toChineseCapital(n)`: digits 零壹貳參肆伍陸柒捌玖, units 拾佰仟, big units 萬億兆, suffix 元整. Zero handling must be correct:
  - 0 -> 零元整, 1050 -> 壹仟零伍拾元整, 12345 -> 壹萬貳仟參佰肆拾伍元整
  - 100000 -> 壹拾萬元整, 10005 -> 壹萬零伍元整, 100200 -> 壹拾萬零貳佰元整
- `formatMoney(n)` -> `NT$ 10,500`.
- `docNumber(type, date, seq)`, `validate(doc)` returning list of missing field keys (`seller`, `client`, `items`).

## 6. Tests (must all pass)

Cover: totals with each tax mode, discount clamp and before-tax order, bad numbers, every Chinese capital example above, doc number format, validate. Add a Playwright e2e ONLY if it stays small (one happy-path test: fill form, check total and capital text). Skip if it needs heavy setup.

## 7. Definition of done

- `node --test test.js` passes.
- Opening `index.html` works with no console errors; visually checked with a screenshot.
- Print preview shows only the document.
- README has run/test instructions + the value section.
- REPORT.md written.
- Git: author is the user (GitHub: VinsOrl). NO Claude co-author or attribution lines in commits. Commit on `main`, folder `week3/` at repo root. Do not push unless I ask.
