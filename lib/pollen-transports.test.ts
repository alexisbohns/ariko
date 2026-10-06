import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTransport } from "./pollen-transports";
import type { FeedConfig } from "./federation";

const HTTP_FEED: FeedConfig = {
  id: "arkaik-pbbls",
  source: "arkaik",
  transport: "http",
  url: "https://arkaik.example/api/pollen",
  tokenEnv: "TEST_ARKAIK_TOKEN",
};
const FILE_FEED: FeedConfig = {
  id: "paulopus",
  source: "paulopus",
  transport: "file",
  url: "https://raw.example/feed.ndjson",
};
const ENV = { TEST_ARKAIK_TOKEN: "tok_test" };

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

test("http transport without its env var fails at construction, loudly", () => {
  assert.throws(() => makeTransport(HTTP_FEED, {}), /TEST_ARKAIK_TOKEN/);
});

test("http transport sends bearer + limit, and after only when cursored", async () => {
  const seen: { url: string; auth: string | null }[] = [];
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    seen.push({
      url: String(input),
      auth: new Headers(init?.headers).get("authorization"),
    });
    return jsonResponse({ pollen: [] });
  }) as typeof fetch;
  const t = makeTransport(HTTP_FEED, ENV, fetchImpl);
  await t.fetchPage(null, null);
  await t.fetchPage("arkaik:01H", null);
  assert.equal(seen[0].auth, "Bearer tok_test");
  assert.match(seen[0].url, /limit=200/);
  assert.doesNotMatch(seen[0].url, /after=/);
  assert.match(seen[1].url, /after=arkaik%3A01H/);
});

test("http transport: empty page is done, non-empty is not", async () => {
  const bodies = [{ pollen: [{ id: "a:1" }] }, { pollen: [] }];
  let i = 0;
  const fetchImpl = (async () => jsonResponse(bodies[i++])) as typeof fetch;
  const t = makeTransport(HTTP_FEED, ENV, fetchImpl);
  const p1 = await t.fetchPage(null, null);
  const p2 = await t.fetchPage("a:1", null);
  assert.notEqual(p1, "gone");
  assert.notEqual(p2, "gone");
  if (p1 === "gone" || p2 === "gone") return;
  assert.equal(p1.done, false);
  assert.equal(p2.done, true);
});

test("http transport maps 410 to gone and other failures to throws", async () => {
  const t410 = makeTransport(HTTP_FEED, ENV, (async () => new Response("", { status: 410 })) as typeof fetch);
  assert.equal(await t410.fetchPage("a:x", null), "gone");
  const t500 = makeTransport(HTTP_FEED, ENV, (async () => new Response("", { status: 500 })) as typeof fetch);
  await assert.rejects(() => t500.fetchPage(null, null), /HTTP 500/);
  const tBad = makeTransport(HTTP_FEED, ENV, (async () => jsonResponse({ nope: 1 })) as typeof fetch);
  await assert.rejects(() => tBad.fetchPage(null, null), /not \{ pollen/);
});

// The conditional half of the HTTP contract (arkaik#490): the server stamps
// a weak ETag on every page and answers a bodiless 304 to a matching
// If-None-Match. Sending the tag back is what turns a six-hourly "nothing
// new" into one validator statement upstream instead of a journal load.
test("http transport sends If-None-Match only when it holds a tag, and reads ETag off a 200", async () => {
  const seen: (string | null)[] = [];
  const fetchImpl = (async (_input: URL | RequestInfo, init?: RequestInit) => {
    seen.push(new Headers(init?.headers).get("if-none-match"));
    return jsonResponse({ pollen: [] }, 200, { ETag: 'W/"3.12.abcd1234"' });
  }) as typeof fetch;
  const t = makeTransport(HTTP_FEED, ENV, fetchImpl);
  const bare = await t.fetchPage("a:1", null);
  const tagged = await t.fetchPage("a:1", 'W/"3.11.abcd1234"');
  assert.deepEqual(seen, [null, 'W/"3.11.abcd1234"']);
  assert.notEqual(bare, "gone");
  assert.notEqual(tagged, "gone");
  if (bare === "gone" || tagged === "gone") return;
  assert.equal(bare.etag, 'W/"3.12.abcd1234"');
  assert.equal(tagged.etag, 'W/"3.12.abcd1234"');
});

test("http transport: 304 is a caught-up page that keeps the tag it sent", async () => {
  const fetchImpl = (async () => new Response(null, { status: 304, headers: { ETag: 'W/"3.12.abcd1234"' } })) as typeof fetch;
  const t = makeTransport(HTTP_FEED, ENV, fetchImpl);
  const page = await t.fetchPage("a:9", 'W/"3.12.abcd1234"');
  assert.notEqual(page, "gone");
  if (page === "gone") return;
  assert.deepEqual(page.envelopes, []);
  assert.equal(page.done, true);
  assert.equal(page.etag, 'W/"3.12.abcd1234"');
});

test("http transport: a 200 without an ETag leaves the tag null, never a stale one", async () => {
  const fetchImpl = (async () => jsonResponse({ pollen: [] })) as typeof fetch;
  const t = makeTransport(HTTP_FEED, ENV, fetchImpl);
  const page = await t.fetchPage("a:1", 'W/"old"');
  assert.notEqual(page, "gone");
  if (page === "gone") return;
  assert.equal(page.etag, null);
});

test("file transport slices by cursor and is always done", async () => {
  const text = '{"id":"p:1"}\n{"id":"p:2"}\nnot json\n';
  const fetchImpl = (async () => new Response(text)) as typeof fetch;
  const t = makeTransport(FILE_FEED, {}, fetchImpl);
  const page = await t.fetchPage("p:1", null);
  assert.notEqual(page, "gone");
  if (page === "gone") return;
  assert.deepEqual(page.envelopes, [{ id: "p:2" }]);
  assert.equal(page.extraRefusals?.length, 1);
  assert.equal(page.done, true);
  assert.equal(page.etag, undefined);
  assert.equal(await t.fetchPage("p:404", null), "gone");
});
