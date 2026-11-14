// The v2 article door cannot publish (spec 2026-11-14 §3.3), and that is a
// property of the store's SOURCE, not of anything the type system sees: a
// `state: "published"` or a `visibility: "public"` added to a write passes
// tsc, `npm test` on the DB-less path, and `npm run build`. Counted against
// comment-stripped source, because the header docblock names these very
// strings in prose (the lib/pwa-source.test.ts lesson).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("lib/articles-v2-store.ts", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

test("the v2 store never writes state: published", () => {
  assert.doesNotMatch(source, /state\s*:\s*["']published/);
});

test("every visibility key in the v2 store is private", () => {
  const keys = [...source.matchAll(/\bvisibility\s*:\s*(\S+)/g)];
  assert.ok(keys.length > 0, "expected the write filters to name visibility: \"private\"");
  for (const m of keys) assert.match(m[1], /^["']private["']/, `visibility set to ${m[1]}`);
});

test('"article-door" appears only in the ownership check, the replace filter and the create', () => {
  assert.equal(source.match(/["']article-door["']/g)?.length, 3);
});
