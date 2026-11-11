import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/hours/route";
import { MAX_SNAPSHOT_BYTES } from "./hours";

function req(body: string, auth?: string, extra: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/hours", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}), ...extra },
    body,
  });
}

test("hours door: HOURS_TOKEN unset refuses everything (fail closed)", async () => {
  delete process.env.HOURS_TOKEN;
  assert.equal((await POST(req("{}", "Bearer anything"))).status, 401);
});

test("hours door: wrong or missing token is 401", async () => {
  process.env.HOURS_TOKEN = "tok_hours_test";
  try {
    assert.equal((await POST(req("{}"))).status, 401);
    assert.equal((await POST(req("{}", "Bearer wrong"))).status, 401);
  } finally {
    delete process.env.HOURS_TOKEN;
  }
});

test("hours door: oversized body is 413 (declared and measured)", async () => {
  process.env.HOURS_TOKEN = "tok_hours_test";
  try {
    const big = "x".repeat(MAX_SNAPSHOT_BYTES + 1);
    assert.equal((await POST(req(big, "Bearer tok_hours_test"))).status, 413);
    const lying = req("{}", "Bearer tok_hours_test", { "content-length": String(MAX_SNAPSHOT_BYTES + 1) });
    assert.equal((await POST(lying)).status, 413);
  } finally {
    delete process.env.HOURS_TOKEN;
  }
});

test("hours door: invalid JSON and invalid snapshot are 400 before any DB touch", async () => {
  process.env.HOURS_TOKEN = "tok_hours_test";
  try {
    assert.equal((await POST(req("{nope", "Bearer tok_hours_test"))).status, 400);
    const res = await POST(req(JSON.stringify({ v: 2 }), "Bearer tok_hours_test"));
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /v must be 1/);
  } finally {
    delete process.env.HOURS_TOKEN;
  }
});
