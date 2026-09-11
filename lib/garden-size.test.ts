import { test } from "node:test";
import assert from "node:assert/strict";
import { GARDEN_WARN_BYTES, gardenCacheWarning } from "./garden-size";

test("a garden comfortably under the ceiling warns about nothing", () => {
  assert.equal(gardenCacheWarning(411_400), null);
});

test("the threshold fires AT the boundary, not one byte past it", () => {
  assert.equal(gardenCacheWarning(GARDEN_WARN_BYTES - 1), null);
  assert.notEqual(gardenCacheWarning(GARDEN_WARN_BYTES), null);
});

// The warning is the ONLY signal this failure mode produces — above 2 MB the
// cache silently stops caching — so it has to name the size, the limit and
// where to read about it, or the person who sees it in a log learns nothing.
test("the warning names the measured size, the real limit, and the spec", () => {
  const warning = gardenCacheWarning(1_600_000);
  assert.ok(warning);
  assert.match(warning, /1563 kB/, "must report the measured size in kB");
  assert.match(warning, /2 MB/, "must name the limit that actually bites");
  assert.match(warning, /2026-09-11-cache-the-garden-design/, "must point at the spec");
});
