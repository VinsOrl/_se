# Week 3 Report

## What was done
Implemented the spec's file list: `index.html`, `app.js`, `lib.js`, `test.js`, `README.md`, plus this report. No dependencies, no build step.

## Test results
`node --test week3/test.js`: 10 tests, 10 pass, 0 fail (re-run after the review fixes below; see the last line of this section for the final run).
Covered: three tax modes, discount clamp and before-tax order, bad numbers, every Chinese-capital example in the spec (plus 100000005 and 1234567890), doc number and sequence, validate, local-date, HTML escaping.

## Browser check
Served `week3/` with `python3 -m http.server` because Chrome would not open `file://` for me, so I did not open the file directly. Filled the form (quote, +5% exclusive, 2 × 5,000, discount 500):
- Preview showed 9,500 + 475 tax = NT$ 9,975, 大寫 玖仟玖佰柒拾伍元整. Correct.
- Client name `<b>ACME</b> Co` rendered as literal text (escaped).
- Clear then Print on an empty form: red message listing seller, client, items; those three fields got the `bad` class.
- Screenshot: `week3/screenshot.jpg`.
- Console: no errors. Caveat: the console tracker started after page load, so load-time errors are not strictly ruled out (the page rendered fully, so unlikely).

**Not verified:** the actual print dialog / print CSS (`@media print` hides the form). I did not open print preview, so "print shows only the document" is untested by me. Please check with Ctrl+P.

## Review (code-review-skill, self-review, no subagents)
Fixed:
- 🟡 Clearing the date field produced a number like `QT--001`; now falls back to today's local date.
- 🟡 "未稅金額" row was hidden for inclusive and shown for none (backwards); now shown for exclusive and inclusive only.
- 🟢 Red highlight on the items box stayed after typing; now cleared on input.
- 🟢 Unused map index removed.

Left as is (known limits):
- The document number is consumed when Print is clicked, even if the user cancels the dialog (the browser gives no reliable signal).
- Amounts are rounded to whole dollars after discount (`base`), so line amounts keep 2 decimals but totals are integers. Marked with a `ponytail:` comment in `lib.js`.
- Negative qty/price are treated as 0 in totals (spec only said bad/non-numeric).
- Playwright e2e skipped (spec says only if small; it needs a browser install).

## Questions
1. Should sequence numbers be consumed only on a successful print? Needs a different approach (e.g. a "mark as issued" button).
2. Keep `screenshot.jpg` in the repo, or delete it?
