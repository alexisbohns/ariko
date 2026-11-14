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
const PLANT_BEAN = `${P}plant-bean`;
// A second plant: everything under it is out of this token's scope.
const ELSEWHERE = `${P}elsewhere`;
const FOREIGN_POD = `${P}foreign`;
const FOREIGN_BEAN = `${P}foreign-bean`;

async function cleanup() {
  const db = await getDb();
  const rx = new RegExp(`^${P}`);
  for (const c of ["plants", "pods", "beans", "sprouts"]) await db.collection(c).deleteMany({ slug: rx });
}

beforeEach(async () => {
  if (!hasDb) return;
  await cleanup();
  const db = await getDb();
  await db.collection("plants").insertMany([
    { slug: PLANT, name: "Plant", description: "", visibility: "private" },
    { slug: ELSEWHERE, name: "Elsewhere", description: "", visibility: "private" },
  ]);
  await db.collection("pods").insertMany([
    { slug: POD, name: "Pod", description: "", parents: [`plant:${PLANT}`], visibility: "private" },
    { slug: OTHER_POD, name: "Other", description: "", parents: [`plant:${PLANT}`], visibility: "private" },
    { slug: FOREIGN_POD, name: "Foreign", description: "", parents: [`plant:${ELSEWHERE}`], visibility: "private" },
  ]);
  await db.collection("beans").insertMany([
    { slug: BEAN, name: "Bean", parents: [`pod:${POD}`], visibility: "private",
      relations: [{ kind: "inspired-by", ref: "plant:x" }] },
    { slug: OTHER_BEAN, name: "Other bean", parents: [`pod:${OTHER_POD}`], visibility: "private" },
    { slug: PLANT_BEAN, name: "Plant bean", parents: [`plant:${PLANT}`], visibility: "private" },
    { slug: FOREIGN_BEAN, name: "Foreign bean", parents: [`pod:${FOREIGN_POD}`], visibility: "private" },
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
  const r = await writeArticlesV2(PLANT, { essays: [essay()] });
  assert.deepEqual(r, { ok: true, essays: [`${P}essay`], narratives: [], written: [`sprout:${P}essay`] });
  const s = await (await getDb()).collection("sprouts").findOne({ slug: `${P}essay` });
  assert.equal(s?.state, "draft");
  assert.equal(s?.kind, "essay");
  assert.deepEqual(s?.about, [`pod:${POD}`, `bean:${BEAN}`]);
  assert.equal(s?.parents, undefined);
  assert.equal(s?.source?.kind, "article-door");
});

test("re-posting replaces a draft", { skip: !hasDb }, async () => {
  await writeArticlesV2(PLANT, { essays: [essay()] });
  const r = await writeArticlesV2(PLANT, { essays: [essay({ content: "Second", about: [BEAN] })] });
  assert.equal(r.ok, true);
  const s = await (await getDb()).collection("sprouts").findOne({ slug: `${P}essay` });
  assert.equal(s?.content, "Second");
  assert.deepEqual(s?.about, [`bean:${BEAN}`]);
});

test("a published or private sprout is refused as already reviewed", { skip: !hasDb }, async () => {
  for (const state of ["published", "private"]) {
    await (await getDb()).collection("sprouts").deleteMany({ slug: `${P}essay` });
    await writeArticlesV2(PLANT, { essays: [essay()] });
    await (await getDb()).collection("sprouts").updateOne({ slug: `${P}essay` }, { $set: { state } });
    const r = await writeArticlesV2(PLANT, { essays: [essay({ content: "clobber" })] });
    assert.deepEqual(r, { ok: false, refused: [`sprout:${P}essay (already reviewed)`], written: [] });
  }
});

test("a draft from another plant's door is refused", { skip: !hasDb }, async () => {
  assert.equal((await writeArticlesV2(ELSEWHERE, { essays: [essay({ about: [FOREIGN_POD] })] })).ok, true);
  const r = await writeArticlesV2(PLANT, { essays: [essay()] });
  assert.deepEqual(r, { ok: false, refused: [`sprout:${P}essay (not written by this door)`], written: [] });
});

test("about outside the plant is refused by name", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(PLANT, { essays: [essay({ about: [FOREIGN_BEAN, FOREIGN_POD] })] });
  assert.deepEqual(r, {
    ok: false,
    refused: [
      `${P}essay: about ${FOREIGN_BEAN} is not in plant ${PLANT}`,
      `${P}essay: about ${FOREIGN_POD} is not in plant ${PLANT}`,
    ],
    written: [],
  });
});

test("an essay can be about pods and beans across the whole plant", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(PLANT, { essays: [essay({ about: [POD, OTHER_POD, OTHER_BEAN, PLANT_BEAN] })] });
  assert.equal(r.ok, true);
  const s = await (await getDb()).collection("sprouts").findOne({ slug: `${P}essay` });
  assert.deepEqual(s?.about, [`pod:${POD}`, `pod:${OTHER_POD}`, `bean:${OTHER_BEAN}`, `bean:${PLANT_BEAN}`]);
});

test("an essay without about is about the plant: a plant parent, no about — and re-anchors both ways", { skip: !hasDb }, async () => {
  const db = await getDb();
  const { about: _omit, ...plantLevel } = essay();
  assert.equal((await writeArticlesV2(PLANT, { essays: [plantLevel] })).ok, true);
  let s = await db.collection("sprouts").findOne({ slug: `${P}essay` });
  assert.deepEqual(s?.parents, [`plant:${PLANT}`]);
  assert.equal(s?.about, undefined);

  assert.equal((await writeArticlesV2(PLANT, { essays: [essay({ about: [BEAN] })] })).ok, true);
  s = await db.collection("sprouts").findOne({ slug: `${P}essay` });
  assert.deepEqual(s?.about, [`bean:${BEAN}`]);
  assert.equal(s?.parents, undefined);

  assert.equal((await writeArticlesV2(PLANT, { essays: [plantLevel] })).ok, true);
  s = await db.collection("sprouts").findOne({ slug: `${P}essay` });
  assert.deepEqual(s?.parents, [`plant:${PLANT}`]);
  assert.equal(s?.about, undefined);
});

test("a narrative on a bean of the pod keeps hand-authored relations", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(PLANT, { narratives: [{ slug: BEAN, content: "Now :entity[x]{ref=bean:test-v2-other-bean}" }] });
  assert.equal(r.ok, true);
  const b = await (await getDb()).collection("beans").findOne({ slug: BEAN });
  assert.match(String(b?.content), /^Now/);
  assert.ok(b?.relations.some((x: { kind: string }) => x.kind === "inspired-by"));
});

test("a narrative on the pod itself", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(PLANT, { narratives: [{ slug: POD, content: "Pod story" }] });
  assert.equal(r.ok, true);
  assert.equal((await (await getDb()).collection("pods").findOne({ slug: POD }))?.content, "Pod story");
});

test("a narrative on a new bean creates it privately under the pod it names; needs a name and a pod", { skip: !hasDb }, async () => {
  const nameless = await writeArticlesV2(PLANT, { narratives: [{ slug: `${P}new`, pod: OTHER_POD, content: "x" }] });
  assert.deepEqual(nameless, { ok: false, refused: [`bean:${P}new (a new bean needs a name)`], written: [] });
  const podless = await writeArticlesV2(PLANT, { narratives: [{ slug: `${P}new`, name: "New", content: "x" }] });
  assert.deepEqual(podless, {
    ok: false,
    refused: [`bean:${P}new (a new bean needs pod: one of ${POD}, ${OTHER_POD})`],
    written: [],
  });
  const foreign = await writeArticlesV2(PLANT, { narratives: [{ slug: `${P}new`, pod: FOREIGN_POD, name: "New", content: "x" }] });
  assert.equal(foreign.ok, false);
  const payload = {
    narratives: [{ slug: `${P}new`, pod: OTHER_POD, name: "New", content: "x" }],
    essays: [essay({ about: [`${P}new`] })],
  };
  const r = await writeArticlesV2(PLANT, payload);
  assert.deepEqual(r, {
    ok: true,
    essays: [`${P}essay`],
    narratives: [`${P}new`],
    written: [`bean:${P}new`, `sprout:${P}essay`],
  });
  const b = await (await getDb()).collection("beans").findOne({ slug: `${P}new` });
  assert.deepEqual(b?.parents, [`pod:${OTHER_POD}`]);
  assert.equal(b?.visibility, "private");
  // Re-posting the very payload that created it is safe: the pod it names is the one it is in.
  assert.equal((await writeArticlesV2(PLANT, payload)).ok, true);
});

test("pod: on an existing bean must name the pod it is in; on a pod it is refused", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(PLANT, {
    narratives: [{ slug: BEAN, pod: OTHER_POD, content: "x" }, { slug: POD, pod: OTHER_POD, content: "y" }],
  });
  assert.deepEqual(r, {
    ok: false,
    refused: [`bean:${BEAN} (not in pod ${OTHER_POD} — move it in the admin)`, `pod:${POD} (pod: is for a bean only)`],
    written: [],
  });
});

test("a narrative on a bean of another pod of the plant, or directly under the plant, is written", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(PLANT, {
    narratives: [{ slug: OTHER_BEAN, content: "o" }, { slug: OTHER_POD, content: "op" }, { slug: PLANT_BEAN, content: "p" }],
  });
  assert.deepEqual(r.ok && r.written, [`bean:${OTHER_BEAN}`, `pod:${OTHER_POD}`, `bean:${PLANT_BEAN}`]);
});

test("a narrative on another plant's pod is refused, not taken for a new bean", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(PLANT, { narratives: [{ slug: FOREIGN_POD, pod: POD, name: "N", content: "x" }] });
  assert.deepEqual(r, { ok: false, refused: [`pod:${FOREIGN_POD} (not in plant ${PLANT})`], written: [] });
  assert.equal(await (await getDb()).collection("beans").countDocuments({ slug: FOREIGN_POD }), 0);
});

test("a narrative on another plant's bean is refused", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(PLANT, { narratives: [{ slug: FOREIGN_BEAN, content: "x" }] });
  assert.deepEqual(r, { ok: false, refused: [`bean:${FOREIGN_BEAN} (not in plant ${PLANT})`], written: [] });
});

test("a public bean and a public pod with prose are refused", { skip: !hasDb }, async () => {
  const db = await getDb();
  await db.collection("beans").updateOne({ slug: BEAN }, { $set: { visibility: "public" } });
  await db.collection("pods").updateOne({ slug: POD }, { $set: { visibility: "public", content: "Live" } });
  const r = await writeArticlesV2(PLANT, { narratives: [{ slug: BEAN, content: "x" }, { slug: POD, content: "y" }] });
  assert.deepEqual(r, { ok: false, refused: [`bean:${BEAN} (already reviewed)`, `pod:${POD} (already reviewed)`], written: [] });
});

test("one refusal writes nothing at all", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(PLANT, {
    essays: [essay()],
    narratives: [{ slug: FOREIGN_BEAN, content: "x" }],
  });
  assert.equal(r.ok, false);
  assert.equal(await (await getDb()).collection("sprouts").countDocuments({ slug: `${P}essay` }), 0);
});

test("an unknown plant refuses everything", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(`${P}gone`, { essays: [essay()] });
  assert.deepEqual(r, { ok: false, refused: [`plant:${P}gone (unknown)`], written: [] });
});

test("a bean or pod with NO visibility field is public, so refused", { skip: !hasDb }, async () => {
  const db = await getDb();
  await db.collection("beans").updateOne({ slug: BEAN }, { $set: { content: "Live" }, $unset: { visibility: "" } });
  await db.collection("pods").updateOne({ slug: POD }, { $set: { content: "Live" }, $unset: { visibility: "" } });
  const r = await writeArticlesV2(PLANT, { narratives: [{ slug: BEAN, content: "x" }, { slug: POD, content: "y" }] });
  assert.deepEqual(r, { ok: false, refused: [`bean:${BEAN} (already reviewed)`, `pod:${POD} (already reviewed)`], written: [] });
});

test("a narrative keeps a stored French half when only English is posted", { skip: !hasDb }, async () => {
  const db = await getDb();
  await db.collection("beans").updateOne({ slug: BEAN }, { $set: { content: { en: "EN", fr: "FR traduit" }, name: { en: "N", fr: "NF" } } });
  await db.collection("pods").updateOne({ slug: POD }, { $set: { content: { en: "EN", fr: "FR pod" } } });
  const r = await writeArticlesV2(PLANT, {
    narratives: [{ slug: BEAN, content: { en: "EN2" }, name: { en: "N2" } }, { slug: POD, content: { en: "PEN2" } }],
  });
  assert.equal(r.ok, true);
  const b = await db.collection("beans").findOne({ slug: BEAN });
  assert.deepEqual(b?.content, { en: "EN2", fr: "FR traduit" });
  assert.deepEqual(b?.name, { en: "N2", fr: "NF" });
  assert.deepEqual((await db.collection("pods").findOne({ slug: POD }))?.content, { en: "PEN2", fr: "FR pod" });
});

test("plain strings stay plain strings", { skip: !hasDb }, async () => {
  const db = await getDb();
  await db.collection("beans").updateOne({ slug: BEAN }, { $set: { content: "old" } });
  await writeArticlesV2(PLANT, { narratives: [{ slug: BEAN, content: "new" }] });
  assert.equal((await db.collection("beans").findOne({ slug: BEAN }))?.content, "new");
});

test("an essay replace merges languages and never blanks a stored description", { skip: !hasDb }, async () => {
  const db = await getDb();
  await writeArticlesV2(PLANT, { essays: [essay({ content: { en: "EN", fr: "FR" }, description: "Desc" })] });
  const r = await writeArticlesV2(PLANT, { essays: [essay({ content: { en: "EN2" } })] });
  assert.equal(r.ok, true);
  const s = await db.collection("sprouts").findOne({ slug: `${P}essay` });
  assert.deepEqual(s?.content, { en: "EN2", fr: "FR" });
  assert.equal(s?.description, "Desc");
});

test("a hand-written draft with the same slug is not replaced", { skip: !hasDb }, async () => {
  const db = await getDb();
  await db.collection("sprouts").insertOne({
    slug: `${P}essay`, name: "Mine", kind: "log", state: "draft", date: "2026-01-01",
    description: "", about: [`bean:${BEAN}`], content: "hand",
  });
  const r = await writeArticlesV2(PLANT, { essays: [essay()] });
  assert.deepEqual(r, { ok: false, refused: [`sprout:${P}essay (not written by this door)`], written: [] });
  assert.equal((await db.collection("sprouts").findOne({ slug: `${P}essay` }))?.content, "hand");
});

test("a new bean is created privately via createBean's shape", { skip: !hasDb }, async () => {
  const r = await writeArticlesV2(PLANT, { narratives: [{ slug: `${P}nb`, pod: POD, name: "NB", description: "D", content: "c" }] });
  assert.equal(r.ok, true);
  const b = await (await getDb()).collection("beans").findOne({ slug: `${P}nb` });
  assert.equal(b?.visibility, "private");
  assert.equal(b?.description, "D");
});

test("relations are mirrored from the MERGED content, keeping a ref only the French half carries", { skip: !hasDb }, async () => {
  const db = await getDb();
  await db.collection("beans").updateOne(
    { slug: BEAN },
    { $set: { content: { en: "EN", fr: `FR :entity[x]{ref=bean:${OTHER_BEAN}}` } } },
  );
  const r = await writeArticlesV2(PLANT, { narratives: [{ slug: BEAN, content: { en: "EN2" } }] });
  assert.equal(r.ok, true);
  const b = await db.collection("beans").findOne({ slug: BEAN });
  assert.ok(b?.relations.some((x: { ref: string }) => x.ref === `bean:${OTHER_BEAN}`));
});

test("a public pod is refused even when its content is blank", { skip: !hasDb }, async () => {
  const db = await getDb();
  await db.collection("pods").updateOne({ slug: POD }, { $set: { visibility: "public" } });
  const r = await writeArticlesV2(PLANT, { narratives: [{ slug: POD, content: "y" }] });
  assert.deepEqual(r, { ok: false, refused: [`pod:${POD} (already reviewed)`], written: [] });
  assert.equal((await db.collection("pods").findOne({ slug: POD }))?.content, undefined);
});
