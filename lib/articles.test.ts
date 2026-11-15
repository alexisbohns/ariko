import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_CONTENT_BYTES, validateText } from "./articles";

// The shared `Text` rules. The door's payload shape is lib/articles-v2.test.ts.
const optional = { required: false };
const required = { required: true };
const err = (r: ReturnType<typeof validateText>) => (r as { error: string }).error;

test("a plain string passes — no migration", () => {
  assert.deepEqual(validateText("## Context\n\nprose", "narrative", optional), { ok: true });
});

test("every prose field accepts a bilingual object", () => {
  assert.deepEqual(validateText({ en: "## Context", fr: "## Contexte" }, "narrative", optional), { ok: true });
});

test("a single-language object is enough", () => {
  assert.deepEqual(validateText({ fr: "## Contexte" }, "narrative", optional), { ok: true });
});

test("an unknown language key is refused rather than silently dropped", () => {
  // {eng: "..."} would otherwise store as an empty Text and publish a blank page.
  assert.match(err(validateText({ eng: "x" }, "narrative", optional)), /narrative: unknown language key: eng/);
});

test("a non-string language part is refused", () => {
  assert.match(err(validateText({ en: 42 }, "narrative", optional)), /narrative\.en must be a string/);
});

test("an empty object carries no prose and is refused", () => {
  assert.match(err(validateText({}, "narrative", optional)), /narrative must carry at least one language/);
});

test("an array is not a Text value", () => {
  assert.match(err(validateText(["x"], "narrative", optional)), /narrative must be a string or/);
});

test("a required value must be non-blank in at least one language", () => {
  assert.match(err(validateText({ en: "   ", fr: "" }, "name", required)), /name is required/);
  assert.match(err(validateText("  ", "name", required)), /name is required/);
  assert.deepEqual(validateText({ en: "", fr: "Nom" }, "name", required), { ok: true });
});

test("the size cap applies per language part, not to the pair", () => {
  const big = "x".repeat(MAX_CONTENT_BYTES + 1);
  const fits = "x".repeat(MAX_CONTENT_BYTES - 4 * 1024);
  assert.match(err(validateText("x".repeat(MAX_CONTENT_BYTES + 1), "content", optional)), /KiB/);
  assert.match(
    err(validateText({ en: big }, "narrative", optional)),
    new RegExp(`narrative\\.en must be at most ${MAX_CONTENT_BYTES / 1024} KiB`),
  );
  // Two near-cap parts together exceed the cap, and that is fine: neither
  // part does on its own.
  assert.deepEqual(validateText({ en: fits, fr: fits }, "narrative", optional), { ok: true });
});
