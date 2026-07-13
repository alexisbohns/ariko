import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/upload/route";

test("401 when no valid bearer token is present", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const form = new FormData();
  form.set("file", new Blob([Buffer.from("x")], { type: "image/png" }), "x.png");
  const res = await POST(
    new Request("http://localhost/api/upload", { method: "POST", body: form }),
  );
  assert.equal(res.status, 401);
});

test("400 when no file field is provided", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const res = await POST(
    new Request("http://localhost/api/upload", {
      method: "POST",
      headers: { authorization: "Bearer tok_master" },
      body: new FormData(),
    }),
  );
  assert.equal(res.status, 400);
});
