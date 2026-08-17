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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
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
  await t.fetchPage(null);
  await t.fetchPage("arkaik:01H");
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
  const p1 = await t.fetchPage(null);
  const p2 = await t.fetchPage("a:1");
  assert.notEqual(p1, "gone");
  assert.notEqual(p2, "gone");
  if (p1 === "gone" || p2 === "gone") return;
  assert.equal(p1.done, false);
  assert.equal(p2.done, true);
});

test("http transport maps 410 to gone and other failures to throws", async () => {
  const t410 = makeTransport(HTTP_FEED, ENV, (async () => new Response("", { status: 410 })) as typeof fetch);
  assert.equal(await t410.fetchPage("a:x"), "gone");
  const t500 = makeTransport(HTTP_FEED, ENV, (async () => new Response("", { status: 500 })) as typeof fetch);
  await assert.rejects(() => t500.fetchPage(null), /HTTP 500/);
  const tBad = makeTransport(HTTP_FEED, ENV, (async () => jsonResponse({ nope: 1 })) as typeof fetch);
  await assert.rejects(() => tBad.fetchPage(null), /not \{ pollen/);
});

test("file transport slices by cursor and is always done", async () => {
  const text = '{"id":"p:1"}\n{"id":"p:2"}\nnot json\n';
  const fetchImpl = (async () => new Response(text)) as typeof fetch;
  const t = makeTransport(FILE_FEED, {}, fetchImpl);
  const page = await t.fetchPage("p:1");
  assert.notEqual(page, "gone");
  if (page === "gone") return;
  assert.deepEqual(page.envelopes, [{ id: "p:2" }]);
  assert.equal(page.extraRefusals?.length, 1);
  assert.equal(page.done, true);
  assert.equal(await t.fetchPage("p:404"), "gone");
});
