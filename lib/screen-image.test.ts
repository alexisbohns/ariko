import { test } from "node:test";
import assert from "node:assert/strict";
import type { MediaImage } from "./data";
import { buildScreenImagePatch, readImageField } from "./screen-image";

const STORED: MediaImage = {
  kind: "image",
  storageKey: "beanstalk/abc",
  url: "https://res.cloudinary.com/x/image/upload/v1/abc.png",
  width: 1179,
  height: 2556,
};

const NEXT: MediaImage = {
  kind: "image",
  storageKey: "beanstalk/def",
  url: "https://res.cloudinary.com/x/image/upload/v1/def.png",
  width: 1179,
  height: 2556,
};

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

function ready(images: MediaImage[]): FormData {
  return form([
    ["image__ready", "1"],
    ...images.map((m) => ["image", JSON.stringify(m)] as [string, string]),
  ]);
}

test("a picker that never mounted writes nothing", () => {
  assert.deepEqual(buildScreenImagePatch({ image: STORED }, form([])), { dirty: false });
});

test("an unchanged save writes nothing", () => {
  assert.deepEqual(buildScreenImagePatch({ image: STORED }, ready([STORED])), { dirty: false });
});

test("a replaced image is dirty", () => {
  assert.deepEqual(buildScreenImagePatch({ image: STORED }, ready([NEXT])), {
    dirty: true,
    image: NEXT,
  });
});

test("a changed dimension alone is dirty — bean-cover.ts reads them", () => {
  const rotated = { ...STORED, width: 2556, height: 1179 };
  assert.deepEqual(buildScreenImagePatch({ image: STORED }, ready([rotated])), {
    dirty: true,
    image: rotated,
  });
});

test("an emptied list is NOT a clear — a screen with no image is not a screen", () => {
  assert.deepEqual(buildScreenImagePatch({ image: STORED }, ready([])), { dirty: false });
});

test("entries that yield no image are a failed save, not a clear", () => {
  const fd = form([
    ["image__ready", "1"],
    ["image", "{not json"],
  ]);
  assert.deepEqual(buildScreenImagePatch({ image: STORED }, fd), { dirty: false });
});

test("an embed is not a candidate", () => {
  const fd = ready([]);
  fd.append("image", JSON.stringify({ kind: "embed", provider: "", url: "https://x.test/a" }));
  assert.deepEqual(buildScreenImagePatch({ image: STORED }, fd), { dirty: false });
});

test("readImageField reports the marker, the count and the first image", () => {
  assert.deepEqual(readImageField(form([])), { ready: false, submitted: 0, image: null });
  assert.deepEqual(readImageField(ready([NEXT])), { ready: true, submitted: 1, image: NEXT });
});
