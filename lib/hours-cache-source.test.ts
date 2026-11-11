import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The reader split for hours (work-hours spec §6): the public zone reads the
// cached snapshot through lib/hours-cache, never lib/hours-store directly.
for (const path of [
  "app/(public)/(chrome)/hours/page.tsx",
  "app/(public)/(chrome)/plant/[slug]/page.tsx",
]) {
  test(`${path} reads hours through lib/hours-cache, never lib/hours-store`, () => {
    const src = readFileSync(join(process.cwd(), path), "utf8");
    // A module SPECIFIER ("…/hours-store", static or dynamic import), not any
    // mention: the page's own comment names the store it must not read.
    assert.doesNotMatch(src, /["'][^"'\n]*hours-store["']/);
  });
}
