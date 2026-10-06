import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  processEnvelopes,
  sliceFeedFile,
  lastEnvelopeId,
  MAX_REFUSAL_RAW_BYTES,
  syncFeed,
  type FeedPage,
  type FeedTransport,
  type PollenSink,
  type PollenDoc,
  type CursorState,
} from "./pollen-sync";
import { mergeBeanstalk } from "./beanstalk";

function envelope(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: 1,
    id: "arkaik:01H0000000000000000000A001",
    at: "2026-08-01T10:00:00Z",
    source: "arkaik",
    kind: "shipped",
    title: "Something shipped",
    anchors: { plant: "plant:pbbls" },
    ...over,
  };
}

test("valid envelopes come back normalized, invalid become refusals", () => {
  const r = processEnvelopes([envelope(), { junk: true }]);
  assert.equal(r.valid.length, 1);
  assert.equal(r.valid[0].id, "arkaik:01H0000000000000000000A001");
  assert.equal(r.refusals.length, 1);
  assert.match(r.refusals[0].reason, /v must be 1/);
  assert.equal(r.refusals[0].raw, JSON.stringify({ junk: true }));
});

test("non-core kind is a warning, not a refusal", () => {
  const r = processEnvelopes([envelope({ kind: "idea.proposed" })]);
  assert.equal(r.valid.length, 1);
  assert.equal(r.refusals.length, 0);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /not in the v1 core/);
});

test("refusal raw is capped at 4 KiB", () => {
  const r = processEnvelopes([{ big: "x".repeat(10_000) }]);
  assert.equal(r.refusals[0].raw.length, MAX_REFUSAL_RAW_BYTES);
});

test("sliceFeedFile without cursor returns every parsed line", () => {
  const text = `${JSON.stringify(envelope({ id: "a:1" }))}\n\n${JSON.stringify(envelope({ id: "a:2" }))}\n`;
  const r = sliceFeedFile(text, null);
  assert.notEqual(r, "gone");
  if (r === "gone") return;
  assert.equal(r.entries.length, 2);
  assert.deepEqual(r.malformed, []);
});

test("sliceFeedFile with a cursor returns only lines after it", () => {
  const text = [envelope({ id: "a:1" }), envelope({ id: "a:2" }), envelope({ id: "a:3" })]
    .map((e) => JSON.stringify(e))
    .join("\n");
  const r = sliceFeedFile(text, "a:2");
  assert.notEqual(r, "gone");
  if (r === "gone") return;
  assert.deepEqual(r.entries.map((e) => (e as { id: string }).id), ["a:3"]);
});

test("sliceFeedFile with a vanished cursor is gone (410-equivalent)", () => {
  assert.equal(sliceFeedFile(JSON.stringify(envelope({ id: "a:1" })), "a:404"), "gone");
});

test("sliceFeedFile records unparseable lines after the cursor as malformed", () => {
  const text = `${JSON.stringify(envelope({ id: "a:1" }))}\nnot json\n`;
  const r = sliceFeedFile(text, "a:1");
  assert.notEqual(r, "gone");
  if (r === "gone") return;
  assert.deepEqual(r.entries, []);
  assert.equal(r.malformed.length, 1);
  assert.match(r.malformed[0].reason, /unparseable/);
});

test("lastEnvelopeId takes the last string id, skipping junk", () => {
  assert.equal(lastEnvelopeId([envelope({ id: "a:1" }), { junk: true }]), "a:1");
  assert.equal(lastEnvelopeId([{ junk: true }]), null);
  assert.equal(lastEnvelopeId([]), null);
});

// In-memory sink capturing every call — no DB in unit tests, house style.
function memorySink(initialCursor: string | null = null, initialEtag: string | null = null) {
  const calls = {
    inserted: [] as string[],
    refused: [] as string[],
    cursors: [] as (string | null)[],
    etags: [] as (string | null)[],
    statuses: [] as string[],
    projected: 0,
  };
  let state: CursorState = { cursor: initialCursor, etag: initialEtag };
  const sink: PollenSink = {
    getCursor: async () => state,
    setCursor: async (_feedId, next, status) => {
      state = next;
      calls.cursors.push(next.cursor);
      calls.etags.push(next.etag);
      calls.statuses.push(status);
    },
    insertNew: async (_feedId, envelopes) => {
      calls.inserted.push(...envelopes.map((e) => e.id));
      return envelopes.length;
    },
    recordRefusals: async (_feedId, refusals) => {
      calls.refused.push(...refusals.map((r) => r.reason));
    },
    projectBeans: async (_feedId, envelopes) => {
      calls.projected += envelopes.length;
      return 0;
    },
  };
  return { sink, calls };
}

function pageTransport(pages: FeedPage[]): FeedTransport {
  let i = 0;
  return { fetchPage: async () => pages[Math.min(i++, pages.length - 1)] };
}

test("syncFeed pages until the empty page, advancing the cursor per page", async () => {
  const { sink, calls } = memorySink();
  const result = await syncFeed(
    "f1",
    pageTransport([
      { envelopes: [envelope({ id: "a:1" }), envelope({ id: "a:2" })], done: false },
      { envelopes: [envelope({ id: "a:3" })], done: false },
      { envelopes: [], done: true },
    ]),
    sink,
  );
  assert.deepEqual(result, { feedId: "f1", stored: 3, refused: 0, status: "ok" });
  assert.deepEqual(calls.inserted, ["a:1", "a:2", "a:3"]);
  assert.deepEqual(calls.cursors, ["a:2", "a:3", "a:3"]);
  assert.equal(calls.projected, 3);
});

test("a refused envelope is recorded and still advances the cursor", async () => {
  const { sink, calls } = memorySink();
  const result = await syncFeed(
    "f1",
    pageTransport([
      { envelopes: [envelope({ id: "a:1" }), { id: "a:2", junk: true }], done: false },
      { envelopes: [], done: true },
    ]),
    sink,
  );
  assert.equal(result.stored, 1);
  assert.equal(result.refused, 1);
  assert.equal(result.status, "ok");
  assert.equal(calls.cursors[0], "a:2");
});

test("gone resets the cursor once and replays from the start", async () => {
  const { sink, calls } = memorySink("a:404");
  const result = await syncFeed(
    "f1",
    pageTransport(["gone", { envelopes: [envelope({ id: "a:1" })], done: true }]),
    sink,
  );
  assert.equal(result.status, "ok");
  assert.equal(result.stored, 1);
  assert.deepEqual(calls.cursors, [null, "a:1"]);
  assert.equal(calls.statuses[0], "rebuilding");
});

test("gone twice is an error, not a loop", async () => {
  const { sink } = memorySink("a:404");
  const result = await syncFeed("f1", pageTransport(["gone", "gone"]), sink);
  assert.equal(result.status, "error");
  assert.match(result.error ?? "", /gone again/);
});

test("a non-empty page that cannot advance the cursor is an error", async () => {
  const { sink } = memorySink("a:1");
  const result = await syncFeed(
    "f1",
    pageTransport([{ envelopes: [{ junk: true }], done: false }]),
    sink,
  );
  assert.equal(result.status, "error");
  assert.match(result.error ?? "", /failed to advance/);
});

// --- the conditional poll (arkaik#490) --------------------------------------
//
// A validator pairs with the page it was earned for: `after` = the cursor the
// request carried. Only a caught-up page leaves the cursor where it was, so
// only its tag is worth storing — a non-empty page's tag names a page the
// next run will never ask for again.

test("the caught-up page's tag is stored beside the cursor; a non-empty page's is dropped", async () => {
  const { sink, calls } = memorySink();
  const result = await syncFeed(
    "f1",
    pageTransport([
      { envelopes: [envelope({ id: "a:1" })], done: false, etag: 'W/"page-0"' },
      { envelopes: [], done: true, etag: 'W/"caught-up"' },
    ]),
    sink,
  );
  assert.equal(result.status, "ok");
  assert.deepEqual(calls.cursors, ["a:1", "a:1"]);
  assert.deepEqual(calls.etags, [null, 'W/"caught-up"']);
});

test("the next run sends the stored tag with the stored cursor, and a 304 keeps both", async () => {
  const { sink, calls } = memorySink("a:1", 'W/"caught-up"');
  const asked: [string | null, string | null][] = [];
  const transport: FeedTransport = {
    fetchPage: async (cursor, etag) => {
      asked.push([cursor, etag]);
      return { envelopes: [], done: true, etag };
    },
  };
  const result = await syncFeed("f1", transport, sink);
  assert.equal(result.status, "ok");
  assert.deepEqual(asked, [["a:1", 'W/"caught-up"']]);
  assert.deepEqual(calls.cursors, ["a:1"]);
  assert.deepEqual(calls.etags, ['W/"caught-up"']);
});

test("gone drops the tag with the cursor, and the replay asks unconditionally", async () => {
  const { sink, calls } = memorySink("a:9", 'W/"stale"');
  const asked: [string | null, string | null][] = [];
  const pages: FeedPage[] = ["gone", { envelopes: [envelope({ id: "a:1" })], done: true }];
  let i = 0;
  const transport: FeedTransport = {
    fetchPage: async (cursor, etag) => {
      asked.push([cursor, etag]);
      return pages[Math.min(i++, pages.length - 1)];
    },
  };
  const result = await syncFeed("f1", transport, sink);
  assert.equal(result.status, "ok");
  assert.deepEqual(asked, [["a:9", 'W/"stale"'], [null, null]]);
  assert.deepEqual(calls.cursors, [null, "a:1"]);
  assert.deepEqual(calls.etags, [null, null]);
});

test("a page without a tag (an older server) stores null, never the tag it was sent", async () => {
  const { sink, calls } = memorySink("a:1", 'W/"old"');
  const result = await syncFeed("f1", pageTransport([{ envelopes: [], done: true }]), sink);
  assert.equal(result.status, "ok");
  assert.deepEqual(calls.etags, [null]);
});

test("a transport throw becomes an error result, never an exception", async () => {
  const { sink } = memorySink();
  const boom: FeedTransport = {
    fetchPage: async () => {
      throw new Error("HTTP 503");
    },
  };
  const result = await syncFeed("f1", boom, sink);
  assert.equal(result.status, "error");
  assert.match(result.error ?? "", /503/);
});

test("file-transport extraRefusals are counted and recorded", async () => {
  const { sink, calls } = memorySink();
  const result = await syncFeed(
    "f1",
    pageTransport([
      {
        envelopes: [envelope({ id: "a:1" })],
        extraRefusals: [{ reason: "unparseable ndjson line", raw: "not json" }],
        done: true,
      },
    ]),
    sink,
  );
  assert.equal(result.refused, 1);
  assert.deepEqual(calls.refused, ["unparseable ndjson line"]);
});

// Conformance: the pollen contract's fixtures (data/pollen/{valid,invalid}/)
// flow through the actual read-model pipeline, not just validatePollen.
// intent-*.json fixtures are Intent envelopes (validated by validateIntent,
// see lib/pollen-fixtures.test.ts) — the reverse-direction envelope, never
// ingested by this Pollen-only read model — so they're excluded here.
test("every valid conformance fixture flows through process → merge cleanly", () => {
  const dir = join(process.cwd(), "data", "pollen", "valid");
  const fixtures = readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "manifest.json" && !f.startsWith("intent-"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as unknown);
  assert.ok(fixtures.length > 0, "no valid fixtures found");
  const { valid, refusals } = processEnvelopes(fixtures);
  assert.deepEqual(refusals.map((r) => r.reason), []); // names what drifted
  assert.equal(valid.length, fixtures.length);
  const docs: PollenDoc[] = valid.map((v) => ({ ...v, feedId: "fixture", syncedAt: "2026-08-17T00:00:00Z" }));
  const entries = mergeBeanstalk([], docs, new Set());
  assert.equal(entries.length, fixtures.length);
});

test("every invalid conformance fixture becomes a refusal, none throw", () => {
  const dir = join(process.cwd(), "data", "pollen", "invalid");
  const fixtures = readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "manifest.json")
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as unknown);
  assert.ok(fixtures.length > 0, "no invalid fixtures found");
  const { valid, refusals } = processEnvelopes(fixtures);
  assert.deepEqual(valid.map((v) => v.id), []); // names any fixture that unexpectedly validates
  assert.equal(refusals.length, fixtures.length);
});
