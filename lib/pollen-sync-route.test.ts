import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/pollen/sync/route";

function req(auth?: string): Request {
  return new Request("http://localhost/api/pollen/sync", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
  });
}

test("sync door: SYNC_TOKEN unset refuses everything (fail closed)", async () => {
  delete process.env.SYNC_TOKEN;
  const res = await POST(req("Bearer anything"));
  assert.equal(res.status, 401);
});

test("sync door: wrong or missing token is 401", async () => {
  process.env.SYNC_TOKEN = "tok_sync_test";
  try {
    assert.equal((await POST(req())).status, 401);
    assert.equal((await POST(req("Bearer wrong"))).status, 401);
  } finally {
    delete process.env.SYNC_TOKEN;
  }
});
