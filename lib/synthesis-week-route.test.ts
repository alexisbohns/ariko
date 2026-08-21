import { test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/synthesis/week/route";

function req(week: string, auth?: string): Request {
  return new Request(`http://localhost/api/synthesis/week?week=${week}`, {
    headers: auth ? { authorization: auth } : {},
  });
}

test("week door: SYNTHESIS_TOKEN unset refuses everything (fail closed)", async () => {
  delete process.env.SYNTHESIS_TOKEN;
  assert.equal((await GET(req("2026-W34", "Bearer anything"))).status, 401);
});

test("week door: wrong or missing token is 401", async () => {
  process.env.SYNTHESIS_TOKEN = "tok_syn_test";
  try {
    assert.equal((await GET(req("2026-W34"))).status, 401);
    assert.equal((await GET(req("2026-W34", "Bearer wrong"))).status, 401);
  } finally {
    delete process.env.SYNTHESIS_TOKEN;
  }
});

test("week door: bad week id is 400 (before any DB touch)", async () => {
  process.env.SYNTHESIS_TOKEN = "tok_syn_test";
  try {
    const res = await GET(req("garbage", "Bearer tok_syn_test"));
    assert.equal(res.status, 400);
  } finally {
    delete process.env.SYNTHESIS_TOKEN;
  }
});
