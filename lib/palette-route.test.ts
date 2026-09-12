import { test } from "node:test";
import assert from "node:assert/strict";
import { closeDb } from "./db";
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
 * THE FAILURE PATH IS STAGED, NOT ASSUMED. Until 2026-09-08 these tests rested
 * on "Mongo is not available under `npm test`, so loadRawGarden throws" — which
 * is true of a plain run and false the moment anyone supplies MONGODB_URI to
 * exercise the DB-gated files. The route then answered 200 and the file failed
 * on an expectation, not on the code. So the 500 case now REMOVES MONGODB_URI
 * for the duration of the call (lib/db.ts throws without it, and never caches a
 * failed connection), and the success case runs only when a database is
 * actually reachable. Both are now deterministic in both environments.
 */

const DB_URI = process.env.MONGODB_URI;
const hasDb = Boolean(DB_URI);

async function get(): Promise<Response> {
  const { GET } = await import("../app/admin/(chrome)/palette/route");
  return GET();
}

// Stage the dataset failure the route promises to survive: no URI, and no
// cached connection left over from a previous call to hand one back anyway.
async function withoutDb<T>(fn: () => Promise<T>): Promise<T> {
  await closeDb();
  delete process.env.MONGODB_URI;
  try {
    return await fn();
  } finally {
    if (DB_URI) process.env.MONGODB_URI = DB_URI;
  }
}

test("a dataset failure is a 500 the client can fall back from, not a leak", async () => {
  const res = await withoutDb(get);
  assert.equal(res.status, 500);
  assert.equal(res.headers.get("cache-control"), "no-store");

  const body = (await res.json()) as { error?: string; items?: PaletteItem[] };
  assert.equal(body.error, "index unavailable");
  // No stack, no connection string, no Mongo message — one opaque line.
  assert.equal(Object.keys(body).length, 1);
  assert.equal(body.items, undefined);
});

test("the handler never throws — a broken index must not 500 the page around it", async () => {
  await assert.doesNotReject(withoutDb(get));
});

test("with a database, the index is served uncached", { skip: !hasDb }, async () => {
  const res = await get();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");

  const body = (await res.json()) as { error?: string; items?: PaletteItem[] };
  assert.equal(body.error, undefined);
  assert.ok(Array.isArray(body.items));
  // The sections are built by lib/palette.ts itself, so a reachable but
  // empty garden still yields rows — an empty array here would mean the index
  // is not being built at all.
  assert.ok((body.items ?? []).some((item) => item.kind === "section"));
});

test.after(async () => {
  await closeDb();
});
