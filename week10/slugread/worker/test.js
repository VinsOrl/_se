import assert from "node:assert/strict";
import worker from "./src/index.js";

const get = async (path, method = "GET") => {
  const r = await worker.fetch(new Request("http://x" + path, { method }));
  return [r.status, await r.json()];
};

assert.deepEqual(await get("/slugify?text=Cr%C3%A8me%20Br%C3%BBl%C3%A9e"), [200, { result: "creme-brulee" }]);
assert.deepEqual(await get("/truncate?text=Hello%20world&n=5"), [200, { result: "Hello…" }]);
assert.deepEqual(await get("/word_count?text=%E6%88%91%E7%88%B1Rust"), [200, { result: 3 }]);
assert.deepEqual(await get("/reading_time?text=a%20b%20c&wpm=2"), [200, { result: 2 }]);
assert.deepEqual(await get("/reading_time?text=a"), [200, { result: 1 }]);
assert.equal((await get("/slugify"))[0], 400);
for (const bad of ["", "-1", "1.5", "abc", "1e3", "9999999999"]) {
  assert.equal((await get(`/truncate?text=x&n=${bad}`))[0], 400, `n=${bad}`);
}
assert.equal((await get("/truncate?text=x"))[0], 400);
assert.equal((await get("/reading_time?text=x&wpm=0"))[0], 400);
assert.equal((await get("/slugify?text=" + "a".repeat(10_001)))[0], 413);
assert.equal((await get("/nope?text=x"))[0], 404);
assert.equal((await get("/slugify?text=x", "POST"))[0], 405);
console.log("ok: worker");
