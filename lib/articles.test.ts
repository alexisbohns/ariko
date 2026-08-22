import { test } from "node:test";
import assert from "node:assert/strict";
import { validateArticlesPayload } from "./articles";

const article = {
  slug: "karma-accountability",
  name: "Karma & Accountability",
  description: "How the octopus keeps score.",
  date: "2026-07-24",
  content: "# Karma\n\nprose",
};
const ok = { container: "plant:paulopus", narrative: "## Context\n\nprose", articles: [article] };

test("a well-formed payload passes", () => {
  assert.deepEqual(validateArticlesPayload(ok), { ok: true });
});

test("narrative-only and articles-only payloads both pass", () => {
  assert.deepEqual(validateArticlesPayload({ container: "pod:celesta", narrative: "x" }), { ok: true });
  assert.deepEqual(validateArticlesPayload({ container: "plant:paulopus", articles: [article] }), {
    ok: true,
  });
});

test("a payload carrying neither half is refused", () => {
  assert.match(
    (validateArticlesPayload({ container: "plant:paulopus" }) as { error: string }).error,
    /narrative or articles/,
  );
});

test("the container must be a plant or pod ref", () => {
  for (const container of ["bean:karma", "paulopus", "plant:", "plant:Bad_Slug", "sprout:x"]) {
    assert.equal(validateArticlesPayload({ ...ok, container }).ok, false, container);
  }
});

test("state is refused whatever its value — the door cannot publish", () => {
  for (const state of ["published", "draft", "private", null, ""]) {
    const result = validateArticlesPayload({ ...ok, articles: [{ ...article, state }] });
    assert.equal(result.ok, false, String(state));
    assert.match((result as { error: string }).error, /state/);
  }
});

test("article fields are checked, and the first failure names the offender", () => {
  const bad = (over: Record<string, unknown>) =>
    validateArticlesPayload({ ...ok, articles: [{ ...article, ...over }] }) as { error: string };
  assert.match(bad({ slug: "Bad Slug" }).error, /Bad Slug/);
  assert.match(bad({ name: "  " }).error, /name/);
  assert.match(bad({ date: "24-07-2026" }).error, /date/);
  assert.match(bad({ content: "x".repeat(64 * 1024 + 1) }).error, /64/);
  assert.match(bad({ content: 42 }).error, /content/);
});

test("duplicate slugs within a batch are refused", () => {
  const result = validateArticlesPayload({ ...ok, articles: [article, { ...article }] });
  assert.match((result as { error: string }).error, /duplicate/);
});

test("unknown top-level keys are ignored, like the pollen envelope", () => {
  assert.deepEqual(validateArticlesPayload({ ...ok, futureThing: 1 }), { ok: true });
});
