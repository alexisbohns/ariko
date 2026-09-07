import { test } from "node:test";
import assert from "node:assert/strict";
import type { Bean, MediaImage, Sprout } from "./data";
import { beanCoverFor, podCoverFrom } from "./bean-cover";

const img = (key: string, size?: { width: number; height: number }): MediaImage => ({
  kind: "image",
  storageKey: key,
  url: `https://res.cloudinary.com/x/image/upload/v1/${key}.png`,
  ...(size ?? {}),
});

const portrait = (key: string) => img(key, { width: 390, height: 844 });
const landscape = (key: string) => img(key, { width: 1600, height: 900 });
const square = (key: string) => img(key, { width: 800, height: 800 });

const bean = (extra: Partial<Bean> = {}): Bean => ({
  slug: "b",
  name: "B",
  parents: ["plant:p"],
  ...extra,
});

const sprout = (media?: Sprout["media"]): Sprout => ({
  slug: "s",
  name: "S",
  type: "release",
  date: "2026-01-01",
  description: "",
  parents: ["bean:b"],
  ...(media ? { media } : {}),
});

test("an explicit PORTRAIT cover is the phone treatment, carrying the keyword", () => {
  const cover = beanCoverFor(bean({ cover: portrait("shot"), keyword: "Timeline" }), []);
  assert.deepEqual(cover, { kind: "phone", image: portrait("shot"), keyword: "Timeline" });
});

test("a portrait cover with no keyword is still a phone, just wordless", () => {
  const cover = beanCoverFor(bean({ cover: portrait("shot") }), []);
  assert.deepEqual(cover, { kind: "phone", image: portrait("shot") });
});

test("an explicit LANDSCAPE cover fills, and drops the keyword", () => {
  const cover = beanCoverFor(bean({ cover: landscape("wide"), keyword: "Timeline" }), []);
  assert.deepEqual(cover, { kind: "fill", image: landscape("wide") });
});

test("an explicit SQUARE cover fills — taller-than-wide is the whole test", () => {
  const cover = beanCoverFor(bean({ cover: square("sq") }), []);
  assert.deepEqual(cover, { kind: "fill", image: square("sq") });
});

test("an explicit cover with NO stored dimensions fills", () => {
  // A pasted third-party URL carries neither width nor height, and lib/inbox.ts
  // deliberately permits those. The safe failure is "no phone", never "no
  // cover".
  const cover = beanCoverFor(bean({ cover: img("pasted"), keyword: "Timeline" }), []);
  assert.deepEqual(cover, { kind: "fill", image: img("pasted") });
});

test("width alone cannot prove portrait, so it fills", () => {
  // isPortrait requires BOTH dimensions. A version that falls back to `?? 0`
  // on the missing one would compare 390 > 0 and draw a phone.
  const image: MediaImage = { ...img("half-w"), width: 390 };
  const cover = beanCoverFor(bean({ cover: image, keyword: "Timeline" }), []);
  assert.deepEqual(cover, { kind: "fill", image });
});

test("height alone cannot prove portrait, so it fills", () => {
  // Same defect, the other missing dimension: `?? 0` on width would compare
  // 844 > 0 and draw a phone around an image with no known width at all.
  const image: MediaImage = { ...img("half-h"), height: 844 };
  const cover = beanCoverFor(bean({ cover: image, keyword: "Timeline" }), []);
  assert.deepEqual(cover, { kind: "fill", image });
});

test("an explicit cover WINS over an available derivation", () => {
  const cover = beanCoverFor(bean({ cover: portrait("chosen"), keyword: "Timeline" }), [sprout([landscape("derived")])]);
  assert.deepEqual(cover, { kind: "phone", image: portrait("chosen"), keyword: "Timeline" });
});

test("no explicit cover falls back to the derivation, and always fills", () => {
  const cover = beanCoverFor(bean(), [sprout([landscape("derived")])]);
  assert.deepEqual(cover, { kind: "fill", image: landscape("derived") });
});

test("a DERIVED portrait image is never a phone", () => {
  // The load-bearing rule. Deriving the treatment from portrait-ness alone
  // would put a bezel around any portrait photograph a sprout happens to carry
  // — a person, a poster, a book. Setting `cover` IS the opt-in.
  const cover = beanCoverFor(bean({ keyword: "Timeline" }), [sprout([portrait("photo")])]);
  assert.deepEqual(cover, { kind: "fill", image: portrait("photo") });
});

test("nothing anywhere is null", () => {
  assert.equal(beanCoverFor(bean(), []), null);
  assert.equal(beanCoverFor(bean(), [sprout()]), null);
  assert.equal(beanCoverFor(bean({ keyword: "Timeline" }), []), null);
});

test("a pod borrows the first cover it can find", () => {
  const borrowed = podCoverFrom([null, { kind: "fill", image: landscape("a") }, { kind: "fill", image: landscape("b") }]);
  assert.deepEqual(borrowed, { kind: "fill", image: landscape("a") });
});

test("a pod borrowing a phone keeps the image and LOSES the word", () => {
  // The word names the bean. On a pod card it would name the wrong thing.
  const borrowed = podCoverFrom([{ kind: "phone", image: portrait("shot"), keyword: "Timeline" }]);
  assert.deepEqual(borrowed, { kind: "phone", image: portrait("shot") });
});

test("a pod whose beans are all coverless borrows nothing", () => {
  assert.equal(podCoverFrom([null, null]), null);
});
