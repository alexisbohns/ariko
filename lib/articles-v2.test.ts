import { test } from "node:test";
import assert from "node:assert/strict";
import { isV2Shape, validateArticlesV2 } from "./articles-v2";

const CLOUD = "ariko";
const IMG = "https://res.cloudinary.com/ariko/image/upload/v1/beanstalk/x.png";
const essay = (over: Record<string, unknown> = {}) => ({
  slug: "feed-redesign",
  date: "2026-11-14",
  name: { en: "Redrawing the feed", fr: "Redessiner le fil" },
  content: { en: `Body\n\n![shot](${IMG})` },
  about: ["pbbls", "feed"],
  ...over,
});
const narrative = (over: Record<string, unknown> = {}) => ({ slug: "feed", content: "Now…", ...over });
const v = (body: unknown) => validateArticlesV2(body, { cloud: CLOUD });

test("isV2Shape keys on essays/narratives", () => {
  assert.equal(isV2Shape({ essays: [] }), true);
  assert.equal(isV2Shape({ narratives: [] }), true);
  assert.equal(isV2Shape({ container: "pod:x" }), false);
  assert.equal(isV2Shape(null), false);
});

test("a valid essay and narrative pass", () => {
  assert.deepEqual(v({ essays: [essay()], narratives: [narrative()] }), { ok: true });
});

test("the payload must carry something", () => {
  assert.equal(v({}).ok, false);
  assert.equal(v({ essays: [], narratives: [] }).ok, false);
});

test("mixing the legacy shape in is refused", () => {
  const r = v({ essays: [essay()], container: "pod:pbbls" });
  assert.deepEqual(r, { ok: false, error: "container is a legacy key — v2 takes essays and narratives only" });
});

for (const key of ["state", "visibility", "kind", "type", "parents", "exhibited"]) {
  test(`refused key on an essay: ${key}`, () => {
    const r = v({ essays: [essay({ [key]: null })] });
    assert.deepEqual(r, { ok: false, error: `feed-redesign: ${key} is not accepted on this door` });
  });
  test(`refused key on a narrative: ${key}`, () => {
    const r = v({ narratives: [narrative({ [key]: "x" })] });
    assert.deepEqual(r, { ok: false, error: `feed: ${key} is not accepted on this door` });
  });
}

test("essay fields", () => {
  assert.match((v({ essays: [essay({ slug: "Bad Slug" })] }) as { error: string }).error, /slug must match/);
  assert.match((v({ essays: [essay({ date: "14/11/2026" })] }) as { error: string }).error, /date is required \(YYYY-MM-DD\)/);
  assert.match((v({ essays: [essay({ name: "  " })] }) as { error: string }).error, /name is required/);
  assert.match((v({ essays: [essay({ content: " " })] }) as { error: string }).error, /content is required/);
  assert.match((v({ essays: [essay({ about: [] })] }) as { error: string }).error, /about must name at least one/);
  assert.match((v({ essays: [essay({ about: ["pod:pbbls"] })] }) as { error: string }).error, /about takes bare slugs/);
  assert.match((v({ essays: [essay({ about: ["feed", "feed"] })] }) as { error: string }).error, /about repeats feed/);
  assert.match((v({ essays: [essay(), essay()] }) as { error: string }).error, /duplicate essay slug: feed-redesign/);
});

test("narrative fields", () => {
  assert.match((v({ narratives: [narrative({ content: "" })] }) as { error: string }).error, /content is required/);
  assert.match((v({ narratives: [narrative(), narrative()] }) as { error: string }).error, /duplicate narrative slug: feed/);
});

test("images: every content part is checked, in both languages", () => {
  const r = v({ essays: [essay({ content: { en: "ok", fr: "![x](https://example.com/a.png)" } })] });
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /^feed-redesign: content\.fr: https:\/\/example\.com\/a\.png is not hosted by Ariko/);
  const n = v({ narratives: [narrative({ content: "![x](./a.png)" })] });
  assert.match((n as { error: string }).error, /^feed: content: \.\/a\.png is not hosted by Ariko/);
});
