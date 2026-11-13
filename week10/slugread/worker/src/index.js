import { slugify, truncate, wordCount, readingTime } from "../../node/index.js";

const MAX_TEXT = 10_000; // characters; bounds CPU per request

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      ...extra,
    },
  });

// Non-negative integer from a query param, or null if absent/invalid.
const toInt = (v) => (v !== null && /^\d{1,9}$/.test(v) ? Number(v) : null);

export default {
  fetch(request) {
    if (request.method !== "GET") return json({ error: "method not allowed" }, 405, { allow: "GET" });

    const { pathname, searchParams: q } = new URL(request.url);
    const run = {
      "/slugify": (t) => slugify(t),
      "/truncate": (t) => {
        const n = toInt(q.get("n"));
        return n === null ? null : truncate(t, n);
      },
      "/word_count": (t) => wordCount(t),
      "/reading_time": (t) => {
        const wpm = q.has("wpm") ? toInt(q.get("wpm")) : 200;
        return wpm ? readingTime(t, wpm) : null;
      },
    }[pathname];
    if (!run) return json({ error: "not found", endpoints: ["/slugify", "/truncate", "/word_count", "/reading_time"] }, 404);

    const text = q.get("text");
    if (text === null) return json({ error: "missing text" }, 400);
    if (text.length > MAX_TEXT) return json({ error: `text longer than ${MAX_TEXT} characters` }, 413);

    const result = run(text);
    if (result === null) return json({ error: "n must be an integer >= 0; wpm must be an integer > 0" }, 400);
    return json({ result });
  },
};
