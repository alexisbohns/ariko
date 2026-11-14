// lib/articles-assets.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleAssetUpload } from "./articles-assets";

const ok = async () => ({ ok: true as const, pod: "pbbls" });
const no = async () => ({ ok: false as const });
const fakeUpload = async () => ({ kind: "image" as const, storageKey: "k", url: "https://res.cloudinary.com/ariko/k.png", width: 10, height: 20 });

function form(file?: Blob, name = "shot.png"): Request {
  const fd = new FormData();
  if (file) fd.append("file", file, name);
  return new Request("http://localhost/api/articles/assets", { method: "POST", headers: { authorization: "Bearer x" }, body: fd });
}

test("401 without a repo token, and nothing uploaded", async () => {
  let called = false;
  const res = await handleAssetUpload(form(new Blob(["x"], { type: "image/png" })), {
    authorize: no,
    upload: async () => { called = true; return fakeUpload(); },
  });
  assert.equal(res.status, 401);
  assert.equal(called, false);
});

test("400 with no file", async () => {
  const res = await handleAssetUpload(form(), { authorize: ok, upload: fakeUpload });
  assert.equal(res.status, 400);
});

test("400 for SVG, naming the rule", async () => {
  const res = await handleAssetUpload(form(new Blob(["<svg/>"], { type: "image/svg+xml" }), "a.svg"), { authorize: ok, upload: fakeUpload });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /image\/svg\+xml is not a supported image/);
});

test("400 for a body that is not multipart", async () => {
  const req = new Request("http://localhost/api/articles/assets", {
    method: "POST",
    headers: { authorization: "Bearer x", "content-type": "application/json" },
    body: JSON.stringify({ file: "x" }),
  });
  const res = await handleAssetUpload(req, { authorize: ok, upload: fakeUpload });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /multipart/);
});

test("200 returns url, width and height", async () => {
  const res = await handleAssetUpload(form(new Blob(["x"], { type: "image/png" })), { authorize: ok, upload: fakeUpload });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { url: "https://res.cloudinary.com/ariko/k.png", width: 10, height: 20 });
});

test("an upload failure is a 502 with an opaque body", async () => {
  const res = await handleAssetUpload(form(new Blob(["x"], { type: "image/png" })), {
    authorize: ok,
    upload: async () => { throw new Error("cloudinary down"); },
  });
  assert.equal(res.status, 502);
  // the provider's message stays in the server log, never in the response
  assert.deepEqual(await res.json(), { error: "upload failed" });
});
