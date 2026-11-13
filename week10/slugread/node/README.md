# slugread

Tiny zero-dependency text helpers. Same behavior in JavaScript, Python and Rust.

```bash
npm install slugread
```

```js
import { slugify, truncate, wordCount, readingTime } from "slugread";

slugify("Crème Brûlée!");         // "creme-brulee"
truncate("Hello world", 5);       // "Hello…"
wordCount("我爱Rust和Python");     // 5  (each CJK character is one word)
readingTime("one two three", 2);  // 2  (minutes, rounded up; default wpm=200)
```

- `slugify` keeps only `a-z0-9` after stripping accents; other characters become `-`.
- `truncate` counts Unicode code points (emoji are one character); `n` must be an integer `>= 0`.
- `readingTime` needs `wpm > 0`.

ESM only. TypeScript types included. MIT license.
