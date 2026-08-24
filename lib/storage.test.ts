import { test } from "node:test";
import assert from "node:assert/strict";
import { toMediaImage, uploadOptions, type Storage } from "./storage";

test("toMediaImage maps a Cloudinary result to a MediaImage descriptor", () => {
  const m = toMediaImage({
    public_id: "beanstalk/abc123",
    secure_url: "https://res.cloudinary.com/x/image/upload/abc123.jpg",
    width: 800,
    height: 600,
  });
  assert.equal(m.kind, "image");
  assert.equal(m.storageKey, "beanstalk/abc123");
  assert.equal(m.url, "https://res.cloudinary.com/x/image/upload/abc123.jpg");
  assert.equal(m.width, 800);
  assert.equal(m.height, 600);
});

test("toMediaImage tolerates missing dimensions", () => {
  const m = toMediaImage({ public_id: "k", secure_url: "https://cdn/x.jpg" });
  assert.equal(m.storageKey, "k");
  assert.equal(m.width, undefined);
});

test("a fake Storage satisfies the interface (used by route tests)", async () => {
  const fake: Storage = {
    uploadImage: async () => ({ kind: "image", storageKey: "k", url: "https://cdn/x.jpg" }),
  };
  const m = await fake.uploadImage(Buffer.from("x"));
  assert.equal(m.storageKey, "k");
});

test("upload options never derive an id from the filename (two same-named files must not collide)", () => {
  const a = uploadOptions("beanstalk", "Screenshot.png");
  const b = uploadOptions("beanstalk", "Screenshot.png");
  // The defect: an explicit public_id made these two the SAME asset, and
  // Cloudinary's signed-upload default of overwrite:true replaced the first.
  assert.ok(!("public_id" in a), `public_id must not be set: ${JSON.stringify(a)}`);
  assert.deepEqual(a, b);
});

test("upload options keep the original filename as context only", () => {
  const o = uploadOptions("beanstalk", "Screenshot.png");
  assert.deepEqual(o.context, { original_filename: "Screenshot.png" });
  assert.equal(o.resource_type, "image");
  assert.equal(o.folder, "beanstalk");
});

test("upload options omit context entirely when there is no filename", () => {
  const o = uploadOptions("beanstalk");
  assert.ok(!("context" in o));
});

test("the folder is caller-supplied, so verification can target a scratch folder", () => {
  assert.equal(uploadOptions("beanstalk/scratch").folder, "beanstalk/scratch");
});
