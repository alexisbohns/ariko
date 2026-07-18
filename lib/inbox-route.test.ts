import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/inbox/route";
import { MAX_INBOX_BODY_BYTES } from "./inbox";

function req(body: unknown, auth?: string): Request {
  return new Request("http://localhost/api/inbox", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: auth } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("413 when the declared/actual body exceeds the cap", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  // No auto content-length in this runtime — this exercises the measured check.
  const res = await POST(req("x".repeat(MAX_INBOX_BODY_BYTES + 1), "Bearer tok_master"));
  assert.equal(res.status, 413);
});

test("413 via the content-length fast path alone (tiny body, lying-large header)", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const res = await POST(
    new Request("http://localhost/api/inbox", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(MAX_INBOX_BODY_BYTES + 1),
      },
      body: "{}",
    }),
  );
  assert.equal(res.status, 413);
});

test("413 on an oversized chunked body with no content-length header", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const chunk = "x".repeat(64 * 1024);
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < 5; i++) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  const res = await POST(
    new Request("http://localhost/api/inbox", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" }),
  );
  assert.equal(res.status, 413);
});

test("a body exactly at the cap passes the size gate", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  // Exactly MAX bytes of junk: not valid JSON, so the 400 (not 413) proves the
  // gate let it through.
  const res = await POST(req("x".repeat(MAX_INBOX_BODY_BYTES), "Bearer tok_master"));
  assert.equal(res.status, 400);
});

// These cases short-circuit before any DB access.
test("401 when the bearer token is missing or unknown", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const res = await POST(req({ title: "hi", source: { kind: "manual" } }));
  assert.equal(res.status, 401);
});

test("403 when the token is not allowed for the source kind", async () => {
  process.env.INBOX_TOKENS = "github:tok_gh";
  const res = await POST(req({ title: "hi", source: { kind: "manual" } }, "Bearer tok_gh"));
  assert.equal(res.status, 403);
});

test("400 on malformed JSON", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const res = await POST(req("{ not json", "Bearer tok_master"));
  assert.equal(res.status, 400);
});

test("400 when title is missing", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const res = await POST(req({ source: { kind: "manual" } }, "Bearer tok_master"));
  assert.equal(res.status, 400);
});

const hasDb = Boolean(process.env.MONGODB_URI);

test("201 creates a capture for a valid authorized payload", { skip: !hasDb }, async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const res = await POST(
    req({ title: "__test__ route", source: { kind: "manual" } }, "Bearer tok_master"),
  );
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.ok(json.id);
  assert.equal(json.created, true);
  // cleanup
  const { getDb, closeDb } = await import("./db");
  const db = await getDb();
  await db.collection("captures").deleteOne({ id: json.id });
  await closeDb();
});
