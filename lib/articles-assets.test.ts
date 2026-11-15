// lib/articles-assets.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleAssetUpload } from "./articles-assets";

const ok = async () => ({ ok: true as const, plant: "pbbls" });
const no = async () => ({ ok: false as const });
const noSvg = async () => { throw new Error("must not upload"); };
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
    uploadSvg: noSvg,
  });
  assert.equal(res.status, 401);
  assert.equal(called, false);
});

test("400 with no file", async () => {
  const res = await handleAssetUpload(form(), { authorize: ok, upload: fakeUpload, uploadSvg: noSvg });
  assert.equal(res.status, 400);
});

test("400 for a body that is not multipart", async () => {
  const req = new Request("http://localhost/api/articles/assets", {
    method: "POST",
    headers: { authorization: "Bearer x", "content-type": "application/json" },
    body: JSON.stringify({ file: "x" }),
  });
  const res = await handleAssetUpload(req, { authorize: ok, upload: fakeUpload, uploadSvg: noSvg });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /multipart/);
});

test("200 returns url, width and height", async () => {
  const res = await handleAssetUpload(form(new Blob(["x"], { type: "image/png" })), { authorize: ok, upload: fakeUpload, uploadSvg: noSvg });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { url: "https://res.cloudinary.com/ariko/k.png", width: 10, height: 20 });
});

test("an upload failure is a 502 with an opaque body", async () => {
  const res = await handleAssetUpload(form(new Blob(["x"], { type: "image/png" })), {
    authorize: ok,
    upload: async () => { throw new Error("cloudinary down"); },
    uploadSvg: noSvg,
  });
  assert.equal(res.status, 502);
  // the provider's message stays in the server log, never in the response
  assert.deepEqual(await res.json(), { error: "upload failed" });
});

const GOOD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>';
const svgRequest = (text: string) => form(new File([text], "a.svg", { type: "image/svg+xml" }), "a.svg");

test("an SVG goes through the check and the SVG uploader", async () => {
  const calls: string[] = [];
  const res = await handleAssetUpload(svgRequest(GOOD_SVG), {
    authorize: ok,
    upload: async () => { throw new Error("the raster uploader must not see an SVG"); },
    uploadSvg: async (b) => {
      calls.push(b.toString());
      return { kind: "image", storageKey: "k", url: "https://res.cloudinary.com/c/image/upload/v1/beanstalk/a.svg" };
    },
  });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  assert.match((await res.json()).url, /\.svg$/);
});

test("what is stored is the checked re-serialization, never the uploaded bytes", async () => {
  // svgo drops the comment; the marker reaching storage means the raw bytes did.
  const withComment = GOOD_SVG.replace("<rect", "<!-- raw-marker --><rect");
  let stored = "";
  const res = await handleAssetUpload(svgRequest(withComment), {
    authorize: ok,
    upload: fakeUpload,
    uploadSvg: async (b) => { stored = b.toString(); return { kind: "image", storageKey: "k", url: "https://x/a.svg" }; },
  });
  assert.equal(res.status, 200);
  assert.match(stored, /^<svg /);
  assert.equal(stored.includes("raw-marker"), false);
});

test("a refused SVG is a 400 naming what was found, and nothing is uploaded", async () => {
  const res = await handleAssetUpload(svgRequest('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script/></svg>'), {
    authorize: ok,
    upload: fakeUpload,
    uploadSvg: noSvg,
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /<script> is not allowed/);
});

test("an oversized SVG is refused before it is read", async () => {
  const big = new File([new Uint8Array(1024 * 1024 + 1)], "a.svg", { type: "image/svg+xml" });
  const res = await handleAssetUpload(form(big, "a.svg"), { authorize: ok, upload: fakeUpload, uploadSvg: noSvg });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /too large/);
});

test("an SVG upload failure is a 502 with an opaque body", async () => {
  const res = await handleAssetUpload(svgRequest(GOOD_SVG), {
    authorize: ok,
    upload: fakeUpload,
    uploadSvg: async () => { throw new Error("cloudinary down"); },
  });
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: "upload failed" });
});
