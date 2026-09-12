import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ensureBotanicalIndexes,
  createPod,
  createBean,
  createScreen,
  createSprout,
  deleteScreen,
  deleteSprout,
  getScreen,
  listScreensForPlant,
  setPublic,
  setPrivate,
  listPods,
  listBeans,
  updateBeanCover,
  updateBeanKeyword,
  updateScreenImage,
  updateScreenMeta,
  writeExhibition,
  SlugExistsError,
} from "./botanical";
import { resolveText } from "./data";
import { getDb, closeDb } from "./db";

const hasDb = Boolean(process.env.MONGODB_URI);

async function cleanup() {
  const db = await getDb();
  await db.collection("pods").deleteMany({ slug: /^__test__/ });
  await db.collection("beans").deleteMany({ slug: /^__test__/ });
  await db.collection("sprouts").deleteMany({ slug: /^__test__/ });
  await db.collection("screens").deleteMany({ slug: /^__test__/ });
}

test("createPod/createBean insert private-by-default", { skip: !hasDb }, async (t) => {
  await ensureBotanicalIndexes();
  t.after(cleanup);
  const m = await createPod({ slug: "__test__m", name: "M", plantSlug: null, description: "" });
  assert.equal(m.visibility, "private");
  const a = await createBean({ slug: "__test__a", name: "A", description: "", podSlug: "__test__m", plantSlug: null });
  assert.equal(a.visibility, "private");
  assert.deepEqual(a.parents, ["pod:__test__m"]);
  const molecules = await listPods();
  const atoms = await listBeans();
  assert.ok(molecules.some((x) => x.slug === "__test__m"));
  assert.ok(atoms.some((x) => x.slug === "__test__a"));
});

test("createBean with no pod is parentless", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const a = await createBean({ slug: "__test__solo", name: "Solo", description: "", podSlug: null, plantSlug: null });
  assert.deepEqual(a.parents, []);
});

test("createSprout writes parents/state/media/source", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const v = await createSprout({
    slug: "__test__v",
    name: "V",
    type: "demo",
    date: "2025-01-01",
    description: "d",
    state: "draft",
    parents: ["bean:__test__a"],
    media: [{ kind: "embed", provider: "youtube", url: "https://youtu.be/x", embedId: "x" }],
    source: { kind: "manual" },
  });
  assert.equal(v.state, "draft");
  assert.deepEqual(v.parents, ["bean:__test__a"]);
});

test("setPublic flips visibility to public", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  await createPod({ slug: "__test__pm", name: "M", plantSlug: null, description: "" });
  await createBean({ slug: "__test__pa", name: "A", description: "", podSlug: "__test__pm", plantSlug: null });
  await setPublic([], ["__test__pm"], ["__test__pa"]);
  const db = await getDb();
  const m = await db.collection("pods").findOne({ slug: "__test__pm" });
  const a = await db.collection("beans").findOne({ slug: "__test__pa" });
  assert.equal(m?.visibility, "public");
  assert.equal(a?.visibility, "public");
});

test("setPublic is a no-op on empty arrays", { skip: !hasDb }, async () => {
  await setPublic([], [], []); // must not throw
});

test("setPrivate flips visibility back to private", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  await createPod({ slug: "__test__qm", name: "M", plantSlug: null, description: "" });
  await createBean({ slug: "__test__qa", name: "A", description: "", podSlug: "__test__qm", plantSlug: null });
  await setPublic([], ["__test__qm"], ["__test__qa"]);
  await setPrivate([], ["__test__qm"], ["__test__qa"]);
  const db = await getDb();
  const m = await db.collection("pods").findOne({ slug: "__test__qm" });
  const a = await db.collection("beans").findOne({ slug: "__test__qa" });
  assert.equal(m?.visibility, "private");
  assert.equal(a?.visibility, "private");
});

test("setPrivate is a no-op on empty arrays", { skip: !hasDb }, async () => {
  await setPrivate([], [], []); // must not throw
});

test("deleteSprout removes only the targeted sprout doc", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const base = {
    name: "Del",
    type: "demo",
    date: "2025-01-01",
    description: "",
    state: "draft" as const,
    parents: [],
    media: [],
    source: { kind: "manual" },
  };
  await createSprout({ slug: "__test__del", ...base });
  await createSprout({ slug: "__test__keep", ...base });
  await deleteSprout("__test__del");
  const db = await getDb();
  assert.equal(await db.collection("sprouts").findOne({ slug: "__test__del" }), null);
  // The delete must be slug-scoped — a sibling doc survives.
  assert.notEqual(await db.collection("sprouts").findOne({ slug: "__test__keep" }), null);
});

test("deleteSprout on a missing slug does not throw", { skip: !hasDb }, async () => {
  await deleteSprout("__test__never-existed"); // deleteOne matches 0 → no-op
});

test("a duplicate slug throws SlugExistsError", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  await createPod({ slug: "__test__dup", name: "M", plantSlug: null, description: "" });
  await assert.rejects(
    () => createPod({ slug: "__test__dup", name: "M2", plantSlug: null, description: "" }),
    (err) => err instanceof SlugExistsError && err.slug === "__test__dup",
  );
});

test("updateBeanCover clears to an ABSENT key, not a stored null", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  await createBean({ slug: "__test__cover", name: "Cover", description: "", podSlug: null, plantSlug: null });
  await updateBeanCover("__test__cover", {
    kind: "image",
    storageKey: "__test__key",
    url: "https://example.com/x.png",
  });
  const db = await getDb();
  const withCover = await db.collection("beans").findOne({ slug: "__test__cover" });
  assert.ok(withCover?.cover);

  await updateBeanCover("__test__cover", null);
  const cleared = await db.collection("beans").findOne({ slug: "__test__cover" });
  // The key must be MISSING, not present-with-null. Nothing MISDRAWS if it is
  // not: lib/bean-cover.ts tests `bean.cover` for truthiness and `fillCoverFor`
  // uses `??`, so a stored null falls through to the derived cover, which is
  // what a cleared override should do. What a stored null breaks is the TYPE —
  // `Bean.cover` is declared optional, not nullable — and the reader that pays
  // for it is the next one written to that declaration: a presence check, a
  // `!== undefined` guard, an `Object.keys`. One representation of "absent" is
  // the thing being asserted here, not one behaviour.
  assert.equal("cover" in (cleared ?? {}), false);
});

test("updateBeanKeyword clears to an ABSENT key, not a stored null", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  await createBean({ slug: "__test__keyword", name: "Keyword", description: "", podSlug: null, plantSlug: null });
  await updateBeanKeyword("__test__keyword", "Timeline");
  const db = await getDb();
  const withKeyword = await db.collection("beans").findOne({ slug: "__test__keyword" });
  assert.equal(withKeyword?.keyword, "Timeline");

  await updateBeanKeyword("__test__keyword", null);
  const cleared = await db.collection("beans").findOne({ slug: "__test__keyword" });
  // Same invariant as the cover above, but here it has teeth: lib/bean-cover.ts
  // branches on `bean.keyword === undefined` by strict identity, so a stored
  // null slips past and is carried into the BeanCover as `keyword: null` — a
  // union member whose present key promises a `Text`. The consumers' own null
  // guards mean nothing visibly breaks today, which is exactly why the
  // invariant is worth pinning at the write end rather than trusted downstream.
  assert.equal("keyword" in (cleared ?? {}), false);
});

test("createScreen round-trips a screen, private and omitting what was blank", { skip: !hasDb }, async (t) => {
  // The unique slug index is what turns the duplicate below into a
  // SlugExistsError rather than a second document.
  await ensureBotanicalIndexes();
  t.after(cleanup);

  const s = await createScreen({
    slug: "__test__screen",
    name: "Home upcoming mock",
    image: {
      kind: "image",
      storageKey: "__test__key",
      url: "https://example.com/home-upcoming-mock.png",
      width: 1179,
      height: 2556,
    },
    plantSlug: "__test__plant",
    relations: [{ kind: "cover", ref: "bean:__test__a" }],
    capturedAt: "2026-09-08",
  });
  assert.equal(s.visibility, "private");
  // The writer owns the ref grammar — the caller handed it a bare slug.
  assert.deepEqual(s.parents, ["plant:__test__plant"]);

  const db = await getDb();
  const stored = await db.collection("screens").findOne({ slug: "__test__screen" });
  assert.equal(stored?.name, "Home upcoming mock");
  // The dimensions are the reason `image` is a MediaImage and not a URL: they
  // are what lib/bean-cover.ts reads to decide a phone treatment, so a
  // round-trip that lost them would lose the point of the field.
  assert.equal(stored?.image?.width, 1179);
  assert.equal(stored?.image?.height, 2556);
  assert.deepEqual(stored?.relations, [{ kind: "cover", ref: "bean:__test__a" }]);
  assert.equal(stored?.capturedAt, "2026-09-08");
  // Omission discipline: an optional field left blank is an ABSENT key, never a
  // stored "" or a materialized [] — the invariant updateBeanCover pins above.
  assert.equal("legend" in (stored ?? {}), false);
  assert.equal("tags" in (stored ?? {}), false);

  await assert.rejects(
    () =>
      createScreen({
        slug: "__test__screen",
        name: "Same slug",
        image: { kind: "image", storageKey: "__test__key2", url: "https://example.com/x.png" },
        plantSlug: "__test__plant",
      }),
    (err) => err instanceof SlugExistsError && err.slug === "__test__screen",
  );
});

test("createScreen omits a legend that carries no words in either language", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  await createScreen({
    slug: "__test__screen-blank",
    name: "Blank",
    image: { kind: "image", storageKey: "__test__k3", url: "https://example.com/y.png" },
    plantSlug: null,
    // A truthy OBJECT holding two empty strings — what a paired bilingual form
    // posts when the author fills neither box.
    legend: { en: "", fr: "" },
  });
  const db = await getDb();
  const stored = await db.collection("screens").findOne({ slug: "__test__screen-blank" });
  assert.equal("legend" in (stored ?? {}), false);
  assert.deepEqual(stored?.parents, []);
});

test("updateScreenMeta writes the named fields and clears the empty ones", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const slug = "__test__screen-meta";
  await createScreen({
    slug,
    name: "Before",
    image: { kind: "image", storageKey: "k", url: "https://x.test/a.png" },
    plantSlug: "__test__plant",
    legend: "gone soon",
    tags: ["a"],
  });

  await updateScreenMeta(slug, {
    name: { en: "After", fr: "Après" },
    legend: null,
    tags: [],
    parents: [],
    relations: [{ kind: "shows", ref: "bean:b" }],
  });

  const stored = await getScreen(slug);
  assert.deepEqual(stored?.name, { en: "After", fr: "Après" });
  assert.equal("legend" in (stored ?? {}), false);
  assert.equal("tags" in (stored ?? {}), false);
  assert.deepEqual(stored?.parents, []);
  assert.deepEqual(stored?.relations, [{ kind: "shows", ref: "bean:b" }]);
  // Untouched by this writer, and that is the promise it makes.
  assert.equal(stored?.image.storageKey, "k");
  assert.equal(stored?.visibility, "private");
});

test("updateScreenImage replaces only the image", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const slug = "__test__screen-image";
  await createScreen({
    slug,
    name: "Shot",
    image: { kind: "image", storageKey: "old", url: "https://x.test/old.png" },
    plantSlug: null,
  });

  await updateScreenImage(slug, {
    kind: "image",
    storageKey: "new",
    url: "https://x.test/new.png",
    width: 10,
    height: 20,
  });

  const stored = await getScreen(slug);
  assert.equal(stored?.image.storageKey, "new");
  assert.equal(stored?.image.height, 20);
  assert.equal(resolveText(stored?.name ?? ""), "Shot");
});

test("deleteScreen removes the document and is idempotent", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const slug = "__test__screen-delete";
  await createScreen({
    slug,
    name: "Doomed",
    image: { kind: "image", storageKey: "k", url: "https://x.test/a.png" },
    plantSlug: null,
  });

  await deleteScreen(slug);
  assert.equal(await getScreen(slug), null);
  await deleteScreen(slug); // a second delete is a no-op, not an error
});

test("writeExhibition promotes in lockstep and withdraws in lockstep", { skip: !hasDb }, async (t) => {
  await ensureBotanicalIndexes();
  t.after(cleanup);

  const image = {
    kind: "image" as const,
    storageKey: "__test__k",
    url: "https://example.com/x.png",
    width: 1179,
    height: 2556,
  };
  await createScreen({ slug: "__test__ex1", name: "One", image, plantSlug: "__test__expl" });
  await createScreen({ slug: "__test__ex2", name: "Two", image, plantSlug: "__test__expl" });

  // Both land private, which is the whole reason the promote half also writes
  // visibility: `exhibited: true` on a private screen renders nothing.
  const before = await listScreensForPlant("__test__expl");
  assert.deepEqual(before.map((s) => s.slug).sort(), ["__test__ex1", "__test__ex2"]);
  assert.equal(before.every((s) => s.visibility === "private"), true);

  await writeExhibition({
    promote: [
      { slug: "__test__ex1", order: 0, joining: true },
      { slug: "__test__ex2", order: 1, joining: true },
    ],
    withdraw: [],
  });

  const db = await getDb();
  const one = await db.collection("screens").findOne({ slug: "__test__ex1" });
  assert.equal(one?.exhibited, true);
  assert.equal(one?.visibility, "public");
  assert.equal(one?.order, 0);

  // The SEQUENCE, which is the whole reason promote is a loop rather than one
  // updateMany: the second row must get order 1, not a copy of the first row's.
  // Without this, an implementation writing a constant order passes every other
  // assertion in this file.
  const two = await db.collection("screens").findOne({ slug: "__test__ex2" });
  assert.equal(two?.order, 1);
  // And the lockstep is asserted on BOTH rows, not just the first: a promote
  // that wrote exhibited/visibility to only one of them would otherwise survive.
  assert.equal(two?.exhibited, true);
  assert.equal(two?.visibility, "public");

  await writeExhibition({
    promote: [{ slug: "__test__ex2", order: 0, joining: false }],
    withdraw: ["__test__ex1"],
  });

  const withdrawn = await db.collection("screens").findOne({ slug: "__test__ex1" });
  assert.ok(withdrawn);
  assert.equal(withdrawn?.visibility, "private");
  // UNSET, not false and not 0: an absent optional field has one representation
  // in this database, which is createScreen's omission discipline continued.
  assert.equal("exhibited" in (withdrawn ?? {}), false);
  assert.equal("order" in (withdrawn ?? {}), false);

  const moved = await db.collection("screens").findOne({ slug: "__test__ex2" });
  assert.equal(moved?.order, 0);
});

test("writeExhibition is a no-op on two empty lists", { skip: !hasDb }, async () => {
  await writeExhibition({ promote: [], withdraw: [] });
});

test("a stale renumber cannot resurrect a screen withdrawn out of band", { skip: !hasDb }, async (t) => {
  // The race this pins: tab A reads the strip, tab B withdraws one screen out
  // of band, then tab A's stale renumber (computed before it saw tab B's
  // write) reaches this function with the withdrawn slug marked `joining:
  // false` — because tab A still believes it is exhibited. Without the
  // `exhibited: true` qualifier on a renumbering row's filter, that write
  // would match the document regardless and set it public and exhibited
  // again, silently undoing tab B's withdrawal.
  await ensureBotanicalIndexes();
  t.after(cleanup);

  const image = {
    kind: "image" as const,
    storageKey: "__test__k",
    url: "https://example.com/x.png",
    width: 1179,
    height: 2556,
  };
  await createScreen({ slug: "__test__race1", name: "One", image, plantSlug: "__test__raceplant" });
  await createScreen({ slug: "__test__race2", name: "Two", image, plantSlug: "__test__raceplant" });

  // Both tabs' shared starting point: both screens exhibited.
  await writeExhibition({
    promote: [
      { slug: "__test__race1", order: 0, joining: true },
      { slug: "__test__race2", order: 1, joining: true },
    ],
    withdraw: [],
  });

  // Tab B withdraws race2, out of band from tab A's point of view.
  await writeExhibition({ promote: [], withdraw: ["__test__race2"] });

  // Tab A, still working from its now-stale read, presses ↑ on race2 — its
  // `exhibitionWrites` call reports `joining: false` because tab A's own
  // world still has race2 exhibited.
  await writeExhibition({
    promote: [
      { slug: "__test__race2", order: 0, joining: false },
      { slug: "__test__race1", order: 1, joining: false },
    ],
    withdraw: [],
  });

  const db = await getDb();
  const race2 = await db.collection("screens").findOne({ slug: "__test__race2" });
  // Still private, still unexhibited: the renumbering row's filter refused to
  // match a document tab B had already taken out of the strip.
  assert.equal(race2?.visibility, "private");
  assert.equal("exhibited" in (race2 ?? {}), false);
  assert.equal("order" in (race2 ?? {}), false);
});

test("listScreensForPlant returns only that plant's screens", { skip: !hasDb }, async (t) => {
  await ensureBotanicalIndexes();
  t.after(cleanup);

  const image = {
    kind: "image" as const,
    storageKey: "__test__k",
    url: "https://example.com/x.png",
    width: 1179,
    height: 2556,
  };
  await createScreen({ slug: "__test__lp1", name: "Mine", image, plantSlug: "__test__lpplant" });
  await createScreen({ slug: "__test__lp2", name: "Theirs", image, plantSlug: "__test__other" });

  const rows = await listScreensForPlant("__test__lpplant");
  assert.deepEqual(rows.map((s) => s.slug), ["__test__lp1"]);
  // The projection, which the deleted listScreens test used to pin. An ObjectId
  // reaching a prop is a serialization error at RENDER time, not build time.
  assert.equal("_id" in rows[0], false);
});

test.after(async () => {
  if (hasDb) await closeDb();
});
