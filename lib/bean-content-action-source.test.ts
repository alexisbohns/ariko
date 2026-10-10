import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const path = "app/admin/actions.ts";
const source = readFileSync(join(process.cwd(), path), "utf8");
const start = source.indexOf("export async function editContainerContentAction");
const end = source.indexOf("\nexport ", start + 1);
const body = source.slice(start, end);

// A bean's narrative is edited through the SAME action a pod's is, so the
// ?lang= rule (content-actions-lang-source.test.ts) covers it without a second
// copy. Three things only this test watches:
test("editContainerContentAction accepts a bean: ref", () => {
  assert.match(body, /BEAN_PREFIX/);
  assert.match(body, /updateBeanContent\(/);
});

test("a projected bean's narrative is read-only, like its every other field", () => {
  // Every bean action in this file redirects on `existing.projected`; the
  // content branch must too, or the one machine-owned tier gains a hand edit.
  assert.match(body, /projected/);
});

test("a bean edit lands back on the bean page", () => {
  assert.match(body, /\/admin\/bean\/\$\{encodeURIComponent\(slug\)\}/);
});
