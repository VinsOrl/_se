# Quote & Invoice Generator (報價單／請款單產生器)

A single-page tool for freelancers: fill in a form, get a print-ready quote (報價單) or invoice (請款單), save it as PDF through the browser's print dialog.

Zero dependencies, no build step, no backend. Data stays in your browser (localStorage).

## Run

Open `index.html` in a browser. Click **Print / Save PDF** and choose "Save as PDF". Only the document is printed.

## Test

```
node --test test.js
```

(Node 18+. Tests cover the pure logic in `lib.js`.)

## Features

- Quote or invoice; auto number `QT-YYYYMMDD-001` / `INV-YYYYMMDD-001` (sequence counts documents already printed that day for that type)
- Tax modes: none, +5% exclusive, 5% inclusive; discount applied before tax
- Total in Chinese capital numerals (大寫金額), e.g. 壹萬零伍佰元整
- Autosave on every input; Clear resets
- Validation on print (seller, client, at least one valid item)
- Preview escapes user input; default date is local, not UTC

## Files

| File | Purpose |
|---|---|
| `index.html` | Layout and print CSS |
| `app.js` | UI: form, live preview, autosave, print |
| `lib.js` | Pure logic (`window.QI` / `module.exports`) |
| `test.js` | `node:test` unit tests |

## Why this project

**Practical value**
- I am the user: side jobs and freelance work need quotes and invoices, and today I hand-edit Word files.
- Many people want it: freelancers, designers, tutors, photographers, small shops. Most have no accounting software.

**Commercial value**
- Freemium SaaS: free = this tool; paid (~NT$99/month) = logo/brand, client address book, history, cloud sync, e-mail sending, payment reminders.
- Commissionable: small businesses pay for a custom version (their template, item catalog, stamp) = one-off fee + hosting.
- Expansion: e-invoice (電子發票) integration, CSV export for the accountant, LINE notification.
