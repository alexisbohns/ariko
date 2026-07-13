import { test } from "node:test";
import assert from "node:assert/strict";
import { toMediaImage, type Storage } from "./storage";

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
