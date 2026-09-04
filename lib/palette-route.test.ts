import { test } from "node:test";
import assert from "node:assert/strict";
import type { PaletteItem } from "./palette";

/**
 * The palette route, exercised the way lib/inbox-route.test.ts exercises its
 * own: import the handler and call it. No server runs.
 *
 * There is no auth case to test here, and that absence is the point — the
 * route lives under /admin, so middleware.ts's existing "/admin/:path*" gate
 * redirects an unauthenticated request before this handler is ever reached.
 * A test asserting a 401 would be testing a check the route deliberately does
 * not have.
 *
 * Mongo is not available under `npm test`, so loadRawGarden throws. That is
 * exactly the failure path §6 of the spec promises, and it is what these tests
 * pin: a 500 with no stack, no-store, and a shape the client can fall back
 * from.
 */

async function get(): Promise<Response> {
  const { GET } = await import("../app/admin/palette/route");
  return GET();
}

test("a dataset failure is a 500 the client can fall back from, not a leak", async () => {
  const res = await get();
  assert.equal(res.status, 500);
  assert.equal(res.headers.get("cache-control"), "no-store");

  const body = (await res.json()) as { error?: string; items?: PaletteItem[] };
  assert.equal(body.error, "index unavailable");
  // No stack, no connection string, no Mongo message — one opaque line.
  assert.equal(Object.keys(body).length, 1);
  assert.equal(body.items, undefined);
});

test("the handler never throws — a broken index must not 500 the page around it", async () => {
  await assert.doesNotReject(get());
});
