import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as lib from "./index.js";

const names = { slugify: "slugify", truncate: "truncate", word_count: "wordCount", reading_time: "readingTime" };
const cases = JSON.parse(readFileSync(new URL("../tests/cases.json", import.meta.url), "utf8"));

for (const c of cases) assert.equal(lib[names[c.fn]](...c.args), c.out, JSON.stringify(c));
assert.throws(() => lib.truncate("x", -1), RangeError);
assert.throws(() => lib.readingTime("x", 0), RangeError);
console.log(`ok: ${cases.length} cases`);
