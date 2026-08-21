import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/synthesis/route";

function req(body: unknown, auth?: string): Request {
  return new Request("http://localhost/api/synthesis", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  });
}

test("write door: SYNTHESIS_TOKEN unset refuses everything (fail closed)", async () => {
  delete process.env.SYNTHESIS_TOKEN;
  assert.equal((await POST(req({}, "Bearer anything"))).status, 401);
});

test("write door: wrong or missing token is 401", async () => {
  process.env.SYNTHESIS_TOKEN = "tok_syn_test";
  try {
    assert.equal((await POST(req({}))).status, 401);
    assert.equal((await POST(req({}, "Bearer wrong"))).status, 401);
  } finally {
    delete process.env.SYNTHESIS_TOKEN;
  }
});

test("write door: malformed body and bad week are 400 before any DB touch", async () => {
  process.env.SYNTHESIS_TOKEN = "tok_syn_test";
  try {
    const raw = new Request("http://localhost/api/synthesis", {
      method: "POST",
      headers: { authorization: "Bearer tok_syn_test" },
      body: "not json",
    });
    assert.equal((await POST(raw)).status, 400);
    assert.equal((await POST(req({ week: "garbage", sprouts: [] }, "Bearer tok_syn_test"))).status, 400);
    assert.equal((await POST(req({ week: "2026-W34" }, "Bearer tok_syn_test"))).status, 400); // sprouts missing
  } finally {
    delete process.env.SYNTHESIS_TOKEN;
  }
});
