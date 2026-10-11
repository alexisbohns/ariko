import { test } from "node:test";
import assert from "node:assert/strict";
import type { Bean, Sprout } from "./data";
import { articleFor, narrativeFor } from "./article";

function sprout(slug: string, date: string, content?: Sprout["content"]): Sprout {
  return {
    slug,
    name: slug,
    type: "article",
    date,
    description: "",
    parents: ["bean:paulopus"],
    ...(content !== undefined ? { content } : {}),
  };
}

test("picks the first sprout carrying content", () => {
  const found = articleFor([
    sprout("b", "2026-08-02", "# newer"),
    sprout("a", "2026-08-01", "# older"),
  ]);
  assert.equal(found?.slug, "b");
});

test("skips a newer sprout with no content at all", () => {
  const found = articleFor([sprout("b", "2026-08-02"), sprout("a", "2026-08-01", "# older")]);
  assert.equal(found?.slug, "a");
});

test("treats a blank string and a blank localized value as absent", () => {
  const found = articleFor([
    sprout("c", "2026-08-03", "   "),
    sprout("b", "2026-08-02", { en: "" }),
    sprout("a", "2026-08-01", "# real"),
  ]);
  assert.equal(found?.slug, "a");
});

test("returns null when nothing carries content", () => {
  assert.equal(articleFor([sprout("a", "2026-08-01")]), null);
});

test("returns null for an empty list", () => {
  assert.equal(articleFor([]), null);
});

// --- narrativeFor: the bean's own content first, a sprout only as the fallback.

function bean(content?: Bean["content"]): Bean {
  return { slug: "b", name: "B", parents: ["plant:p"], ...(content !== undefined ? { content } : {}) };
}

test("narrativeFor: the bean's own content wins, undated", () => {
  const r = narrativeFor(bean({ en: "mine" }), [sprout("theirs", "2026-01-01", "theirs")]);
  assert.deepEqual(r, { content: { en: "mine" }, date: undefined });
});

test("narrativeFor: without bean content the newest sprout with prose is read, dated (slice-two fallback)", () => {
  const r = narrativeFor(bean(), [sprout("new", "2026-02-01", ""), sprout("old", "2026-01-01", "old")]);
  assert.deepEqual(r, { content: "old", date: "2026-01-01" });
});

test("narrativeFor: nothing to read is null", () => {
  assert.equal(narrativeFor(bean({ en: "  " }), []), null);
});
