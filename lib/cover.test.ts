import { test } from "node:test";
import assert from "node:assert/strict";
import type { Sprout } from "./data";
import { coverFor } from "./cover";

const sprout = (slug: string, date: string, media?: Sprout["media"]): Sprout => ({
  slug,
  name: slug,
  type: "release",
  date,
  description: "",
  parents: ["bean:x"],
  ...(media ? { media } : {}),
});

const img = (key: string) => ({ kind: "image" as const, storageKey: key, url: `https://cdn/${key}.jpg` });
const embed = (url: string) => ({ kind: "embed" as const, provider: "link", url });

test("no sprouts means no cover", () => {
  assert.equal(coverFor([]), null);
});

test("no images anywhere means no cover", () => {
  assert.equal(coverFor([sprout("a", "2026-01-01"), sprout("b", "2025-01-01", [embed("https://x")])]), null);
});

test("the FIRST image of the newest sprout that has one", () => {
  const cover = coverFor([sprout("a", "2026-01-01", [img("k1"), img("k2")])]);
  assert.equal(cover?.storageKey, "k1");
});

// The umbrella's wording ("the newest published sprout's media[]") could mean
// "strictly the newest, or nothing". Resolved toward its sibling articleFor,
// which returns the first sprout CARRYING content rather than giving up at the
// newest — so a bean whose latest sprout is a text-only changelog entry keeps
// the cover its previous release earned.
test("scans past a newer sprout that has no image", () => {
  const cover = coverFor([
    sprout("changelog", "2026-06-01"),
    sprout("release", "2026-01-01", [img("k9")]),
  ]);
  assert.equal(cover?.storageKey, "k9");
});

test("an embed before an image is skipped — a cover is an image", () => {
  const cover = coverFor([sprout("a", "2026-01-01", [embed("https://x"), img("k3")])]);
  assert.equal(cover?.storageKey, "k3");
});

test("a sprout whose media is only embeds does not stop the scan", () => {
  const cover = coverFor([
    sprout("newer", "2026-06-01", [embed("https://x")]),
    sprout("older", "2026-01-01", [img("k4")]),
  ]);
  assert.equal(cover?.storageKey, "k4");
});

test("input order is respected as given — the caller supplies newest-first", () => {
  // Same as articleFor: ordering is the dataset's guarantee, not this
  // function's job. Given oldest-first, it honestly returns the oldest.
  const cover = coverFor([sprout("old", "2020-01-01", [img("old")]), sprout("new", "2026-01-01", [img("new")])]);
  assert.equal(cover?.storageKey, "old");
});
