import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/inbox/route";

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
