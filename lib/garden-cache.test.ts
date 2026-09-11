import { test } from "node:test";
import assert from "node:assert/strict";
import { GARDEN_TAG, GARDEN_TTL, isMissingRequestStore, revalidateGarden } from "./garden-cache";

/**
 * `revalidateGarden`'s one tolerated failure, and its refusal of every other.
 *
 * This file exists because the slice's design got a fact wrong. It asserted
 * that the four write doors were all places "where `node --test` never runs",
 * and `lib/articles-route.test.ts` disproves it: it imports `POST` from
 * `app/api/articles/route.ts` and calls it against a real database. That is a
 * good test and it is not a Next request, so `revalidateTag` finds no store
 * and throws — which took `npm run test:db` red the moment the door was wired.
 *
 * The fix is a catch narrow enough to keep the property the door exists for.
 * These two tests are what stop it widening into a `catch {}`, which would
 * turn "the public site went stale" into a silent outcome.
 */

test("calling it outside a Next request context is tolerated, not fatal", () => {
  // This test file IS the reproduction: node --test has no request store, so
  // an unguarded revalidateTag throws here exactly as it did in the route test.
  assert.doesNotThrow(() => revalidateGarden());
});

test("every other failure is rethrown, so a real one cannot be swallowed", () => {
  // The half that matters and the half a `catch {}` would destroy. If Next
  // ever fails a revalidation for a reason that is NOT "no request store" —
  // a bad tag, an internal error — the door must go red, not quietly serve a
  // stale public site.
  assert.equal(isMissingRequestStore(new Error("connection reset")), false);
  assert.equal(isMissingRequestStore(new TypeError("tags must be strings")), false);
  // Not an Error at all. `throw "string"` is legal JavaScript and must not be
  // read as the tolerated case just because it lacks a `.message`.
  assert.equal(isMissingRequestStore("static generation store missing"), false);
  assert.equal(isMissingRequestStore(undefined), false);

  // And the one case that IS tolerated, matched on the real message Next
  // throws — reproduced verbatim from lib/articles-route.test.ts's failure.
  assert.equal(
    isMissingRequestStore(
      new Error("Invariant: static generation store missing in revalidateTag garden"),
    ),
    true,
  );
});

test("the tag and the TTL are the values the write doors and the spec assume", () => {
  // GARDEN_TAG is half of a contract whose other half is loadCachedGarden's
  // `tags` option; they are in one module precisely so they cannot drift, and
  // this pins the literal a reader of the spec would look for.
  assert.equal(GARDEN_TAG, "garden");
  // Five minutes. The backstop for a write door nobody wired, per the design's
  // §3.1 — long enough to be a cache, short enough that a miss is embarrassing
  // rather than damaging.
  assert.equal(GARDEN_TTL, 300);
});
