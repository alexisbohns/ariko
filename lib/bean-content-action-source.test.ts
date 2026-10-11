import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const path = "app/admin/actions.ts";
const source = readFileSync(join(process.cwd(), path), "utf8");
const marker = "export async function editContainerContentAction";
const start = source.indexOf(marker);
assert.ok(start !== -1, `could not find ${marker} in ${path}`);
const end = source.indexOf("\nexport ", start + marker.length);
// Comment-stripped, as lib/pwa-source.test.ts does: the function's own docblock
// and inline notes name every token below, so matching the raw text would pass
// with the code deleted and the comments left standing.
const body = source
  .slice(start, end === -1 ? source.length : end)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

// The slice boundary is asserted, not assumed (content-actions-lang-source.test.ts
// does the same): a helper declared between this action and the next export
// would make every check below read a neighbour's body.
test("the slice holds exactly one function declaration", () => {
  assert.equal(body.match(/\basync function /g)?.length, 1);
});

// A bean's narrative is edited through the SAME action a pod's is, so the
// ?lang= rule (content-actions-lang-source.test.ts) covers it without a second
// copy. Three things only this test watches:
test("editContainerContentAction accepts a bean: ref", () => {
  assert.match(body, /ref\.startsWith\(BEAN_PREFIX\)/);
  assert.match(body, /updateBeanContent\(/);
});

test("a projected bean's narrative is read-only, like its every other field", () => {
  // Every bean action in this file redirects on `existing.projected`; the
  // content branch must too, or the one machine-owned tier gains a hand edit.
  // The GUARD is matched, not the word: the comment above it says "projected"
  // too, and would keep a test on the bare word green with the line deleted.
  assert.match(body, /if \(isBean && .*existing\.projected\) redirect\(back\);/);
});

test("a bean edit lands back on the bean page", () => {
  assert.match(body, /\/admin\/bean\/\$\{encodeURIComponent\(slug\)\}/);
});
