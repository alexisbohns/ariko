import { test } from "node:test";
import assert from "node:assert/strict";
import type { Sprout } from "./data";
import { articleFor } from "./article";

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
