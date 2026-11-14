// lib/articles-v2-store.test.ts
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getDb, closeDb } from "./db";
import { writeArticlesV2 } from "./articles-v2-store";

const hasDb = Boolean(process.env.MONGODB_URI);
const P = "test-v2-";
const PLANT = `${P}plant`;
const POD = `${P}pod`;
const OTHER_POD = `${P}other`;
const BEAN = `${P}bean`;
const OTHER_BEAN = `${P}other-bean`;

async function cleanup() {
  const db = await getDb();
  const rx = new RegExp(`^${P}`);
  for (const c of ["plants", "pods", "beans", "sprouts"]) await db.collection(c).deleteMany({ slug: rx });
}

beforeEach(async () => {
  if (!hasDb) return;
  await cleanup();
  const db = await getDb();
  await db.collection("plants").insertOne({ slug: PLANT, name: "Plant", description: "", visibility: "private" });
  await db.collection("pods").insertMany([
    { slug: POD, name: "Pod", description: "", parents: [`plant:${PLANT}`], visibility: "private" },
    { slug: OTHER_POD, name: "Other", description: "", parents: [`plant:${PLANT}`], visibility: "private" },
  ]);
  await db.collection("beans").insertMany([
    { slug: BEAN, name: "Bean", parents: [`pod:${POD}`], visibility: "private",
      relations: [{ kind: "inspired-by", ref: "plant:x" }] },
    { slug: OTHER_BEAN, name: "Other bean", parents: [`pod:${OTHER_POD}`], visibility: "private" },
  ]);
});
after(async () => {
  if (!hasDb) return;
  await cleanup();
  await closeDb();
});

const essay = (over = {}) => ({
  slug: `${P}essay`, date: "2026-11-14", name: "Essay", content: "Body", about: [POD, BEAN], ...over,
});

test("an essay is written as a draft essay with about refs and no parents", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(POD, { essays: [essay()] });
  assert.deepEqual(r, { ok: true, essays: [`${P}essay`], narratives: [] });
  const s = await (await getDb()).collection("sprouts").findOne({ slug: `${P}essay` });
  assert.equal(s?.state, "draft");
  assert.equal(s?.kind, "essay");
  assert.deepEqual(s?.about, [`pod:${POD}`, `bean:${BEAN}`]);
  assert.equal(s?.parents, undefined);
  assert.equal(s?.source?.kind, "article-door");
});

test("re-posting replaces a draft", { skip: !hasDb }, async () => {
  await writeArticlesV2(POD, { essays: [essay()] });
  const r = await writeArticlesV2(POD, { essays: [essay({ content: "Second", about: [BEAN] })] });
  assert.equal(r.ok, true);
  const s = await (await getDb()).collection("sprouts").findOne({ slug: `${P}essay` });
  assert.equal(s?.content, "Second");
  assert.deepEqual(s?.about, [`bean:${BEAN}`]);
});

test("a published or private sprout is refused as already reviewed", { skip: !hasDb }, async () => {
  for (const state of ["published", "private"]) {
    await (await getDb()).collection("sprouts").deleteMany({ slug: `${P}essay` });
    await writeArticlesV2(POD, { essays: [essay()] });
    await (await getDb()).collection("sprouts").updateOne({ slug: `${P}essay` }, { $set: { state } });
    const r = await writeArticlesV2(POD, { essays: [essay({ content: "clobber" })] });
    assert.deepEqual(r, { ok: false, refused: [`sprout:${P}essay (already reviewed)`] });
  }
});

test("a draft from another pod is refused", { skip: !hasDb }, async () => {
  await writeArticlesV2(OTHER_POD, { essays: [essay({ about: [OTHER_POD] })] });
  const r = await writeArticlesV2(POD, { essays: [essay()] });
  assert.deepEqual(r, { ok: false, refused: [`sprout:${P}essay (not in pod ${POD})`] });
});

test("about outside the pod is refused by name", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(POD, { essays: [essay({ about: [OTHER_BEAN] })] });
  assert.deepEqual(r, { ok: false, refused: [`${P}essay: about ${OTHER_BEAN} is not in pod ${POD}`] });
});

test("a narrative on a bean of the pod keeps hand-authored relations", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(POD, { narratives: [{ slug: BEAN, content: "Now :entity[x]{ref=bean:test-v2-other-bean}" }] });
  assert.equal(r.ok, true);
  const b = await (await getDb()).collection("beans").findOne({ slug: BEAN });
  assert.match(String(b?.content), /^Now/);
  assert.ok(b?.relations.some((x: { kind: string }) => x.kind === "inspired-by"));
});

test("a narrative on the pod itself", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(POD, { narratives: [{ slug: POD, content: "Pod story" }] });
  assert.equal(r.ok, true);
  assert.equal((await (await getDb()).collection("pods").findOne({ slug: POD }))?.content, "Pod story");
});

test("a narrative on a new bean creates it privately under the pod; needs a name", { skip: !hasDb }, async () => {
  const nameless = await writeArticlesV2(POD, { narratives: [{ slug: `${P}new`, content: "x" }] });
  assert.deepEqual(nameless, { ok: false, refused: [`bean:${P}new (a new bean needs a name)`] });
  const r = await writeArticlesV2(POD, {
    narratives: [{ slug: `${P}new`, name: "New", content: "x" }],
    essays: [essay({ about: [`${P}new`] })],
  });
  assert.equal(r.ok, true);
  const b = await (await getDb()).collection("beans").findOne({ slug: `${P}new` });
  assert.deepEqual(b?.parents, [`pod:${POD}`]);
  assert.equal(b?.visibility, "private");
});

test("a narrative on another pod's bean is refused", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(POD, { narratives: [{ slug: OTHER_BEAN, content: "x" }] });
  assert.deepEqual(r, { ok: false, refused: [`bean:${OTHER_BEAN} (not in pod ${POD})`] });
});

test("a public bean and a public pod with prose are refused", { skip: !hasDb }, async () => {
  const db = await getDb();
  await db.collection("beans").updateOne({ slug: BEAN }, { $set: { visibility: "public" } });
  await db.collection("pods").updateOne({ slug: POD }, { $set: { visibility: "public", content: "Live" } });
  const r = await writeArticlesV2(POD, { narratives: [{ slug: BEAN, content: "x" }, { slug: POD, content: "y" }] });
  assert.deepEqual(r, { ok: false, refused: [`bean:${BEAN} (already reviewed)`, `pod:${POD} (already reviewed)`] });
});

test("one refusal writes nothing at all", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(POD, {
    essays: [essay()],
    narratives: [{ slug: OTHER_BEAN, content: "x" }],
  });
  assert.equal(r.ok, false);
  assert.equal(await (await getDb()).collection("sprouts").countDocuments({ slug: `${P}essay` }), 0);
});

test("an unknown pod refuses everything", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(`${P}gone`, { essays: [essay()] });
  assert.deepEqual(r, { ok: false, refused: [`pod:${P}gone (unknown)`] });
});
