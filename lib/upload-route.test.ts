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

test("400 when the file is not a supported image (guarded before any upload)", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const form = new FormData();
  form.set("file", new Blob([Buffer.from("%PDF-1.4")], { type: "application/pdf" }), "x.pdf");
  const res = await POST(
    new Request("http://localhost/api/upload", {
      method: "POST",
      headers: { authorization: "Bearer tok_master" },
      body: form,
    }),
  );
  // 400, not 502: this must be refused by the guard, never attempted against
  // Cloudinary (there is no CLOUDINARY_URL in the test environment, so an
  // attempt would surface as a 502).
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /not a supported image/);
});

test("400 when the file is empty", async () => {
  process.env.INBOX_TOKENS = "*:tok_master";
  const form = new FormData();
  form.set("file", new Blob([], { type: "image/png" }), "empty.png");
  const res = await POST(
    new Request("http://localhost/api/upload", {
      method: "POST",
      headers: { authorization: "Bearer tok_master" },
      body: form,
    }),
  );
  assert.equal(res.status, 400);
});
