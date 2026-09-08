import { test } from "node:test";
import assert from "node:assert/strict";
import type { MediaImage } from "./data";
import { buildNewScreenInput } from "./screen-create";

const IMAGE: MediaImage = {
  kind: "image",
  storageKey: "beanstalk/abc",
  url: "https://res.cloudinary.com/x/image/upload/v1/abc.png",
  width: 1179,
  height: 2556,
};

function form(fields: Record<string, string>, withImage = true): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  if (withImage) {
    fd.set("image__ready", "1");
    fd.append("image", JSON.stringify(IMAGE));
  }
  return fd;
}

test("a complete form yields the input createScreen wants", () => {
  const result = buildNewScreenInput(
    form({ slug: "karma-top", name: "Karma top", plant: "paulopus" }),
  );
  assert.deepEqual(result, {
    ok: true,
    input: { slug: "karma-top", name: "Karma top", image: IMAGE, plantSlug: "paulopus" },
  });
});

test("a blank name falls back to the slug, derived the import's way", () => {
  const result = buildNewScreenInput(form({ slug: "match-hero-m104", name: "", plant: "" }));
  assert.equal(result.ok && result.input.name, "Match hero m104");
  assert.equal(result.ok && result.input.plantSlug, null);
});

test("a missing slug is refused", () => {
  assert.deepEqual(buildNewScreenInput(form({ slug: "", name: "x" })), {
    ok: false,
    error: "a screen needs a slug",
  });
});

test("a slug that is not kebab-case is refused, and the message says what is allowed", () => {
  assert.deepEqual(buildNewScreenInput(form({ slug: "Karma Top" })), {
    ok: false,
    error: "a slug is lowercase letters, digits and hyphens: Karma Top",
  });
});

test("a form the picker never mounted in is refused", () => {
  assert.deepEqual(buildNewScreenInput(form({ slug: "karma-top" }, false)), {
    ok: false,
    error: "add an image — the picker needs script to run",
  });
});

test("a mounted picker with no image is refused with its own message", () => {
  const fd = form({ slug: "karma-top" }, false);
  fd.set("image__ready", "1");
  assert.deepEqual(buildNewScreenInput(fd), { ok: false, error: "add an image" });
});
