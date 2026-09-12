import { test } from "node:test";
import assert from "node:assert/strict";
import type { Seed } from "./data";
import { filterSeedsByPlant } from "./inbox-filter";

// A real Seed, honestly typed — no cast. `promotedTo` and `updatedAt` are
// required on Seed even though the plan's inline sample omitted both.
const seed = (id: string, plantSlug?: string): Seed => ({
  id,
  title: id,
  body: {},
  media: [],
  status: "inbox",
  promotedTo: [],
  createdAt: "2026-09-12T00:00:00.000Z",
  updatedAt: "2026-09-12T00:00:00.000Z",
  source: { kind: "manual" },
  ...(plantSlug ? { suggested: { plantSlug } } : {}),
});

const SEEDS = [seed("a", "ariko"), seed("b", "pebbles"), seed("c"), seed("d", "ghost")];

test("no scope is no filter", () => {
  assert.equal(filterSeedsByPlant(SEEDS, null).length, 4);
});

test("an empty string is no scope too, the same falsy check as null", () => {
  assert.equal(filterSeedsByPlant(SEEDS, "").length, 4);
});

test("a scope keeps only the seeds that suggest it", () => {
  assert.deepEqual(
    filterSeedsByPlant(SEEDS, "ariko").map((s) => s.id),
    ["a"],
  );
});

test("a seed suggesting nothing is not evidence of membership", () => {
  // It appears under All and nowhere else — the rule plantMark already follows
  // when it declines to draw an avatar for an unresolvable suggestion.
  assert.equal(
    filterSeedsByPlant(SEEDS, "ariko").some((s) => s.id === "c"),
    false,
  );
});

test("a suggestion naming nothing real simply matches nothing real", () => {
  assert.deepEqual(
    filterSeedsByPlant(SEEDS, "ghost").map((s) => s.id),
    ["d"],
  );
});
