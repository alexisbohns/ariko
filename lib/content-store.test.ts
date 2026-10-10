import { test } from "node:test";
import assert from "node:assert/strict";
import {
  updateSproutContent,
  updatePlantContent,
  updatePodContent,
  updateBeanContent,
  updateSproutAnchor,
  updateSproutKind,
} from "./botanical";
import { closeDb, getDb } from "./db";

const hasDb = Boolean(process.env.MONGODB_URI);

async function cleanup() {
  const db = await getDb();
  await db.collection("plants").deleteMany({ slug: /^__test__/ });
  await db.collection("pods").deleteMany({ slug: /^__test__/ });
  await db.collection("beans").deleteMany({ slug: /^__test__/ });
  await db.collection("sprouts").deleteMany({ slug: /^__test__/ });
}

test("a content write touches content and relations and NOTHING else", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("sprouts").insertOne({
    slug: "__test__s",
    name: "S",
    kind: "milestone",
    date: "2026-08-23",
    description: "keep me",
    about: ["bean:__test__b"],
    state: "published",
    media: [{ kind: "image", storageKey: "k", url: "https://e.com/i.png" }],
    source: { kind: "manual" },
    content: "before",
  });

  await updateSproutContent("__test__s", {
    content: "after",
    relations: [{ kind: "embeds", ref: "bean:x" }],
  });

  const stored = await db.collection("sprouts").findOne({ slug: "__test__s" });
  assert.equal(stored?.content, "after");
  assert.deepEqual(stored?.relations, [{ kind: "embeds", ref: "bean:x" }]);
  // The fields a content save must never disturb (spec §9 acceptance).
  assert.equal(stored?.state, "published");
  assert.equal(stored?.description, "keep me");
  assert.equal(stored?.kind, "milestone");
  assert.deepEqual(stored?.about, ["bean:__test__b"]);
  assert.equal((stored?.media as unknown[])?.length, 1);
  assert.deepEqual(stored?.source, { kind: "manual" });
});

test("a bean content write touches content and relations and NOTHING else", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("beans").insertOne({
    slug: "__test__bean",
    name: "B",
    parents: ["plant:__test__p"],
    description: "d",
    visibility: "private",
    cover: { url: "https://example.test/c.png", provider: "cloudinary" },
    keyword: "k",
    tags: ["t"],
  });

  await updateBeanContent("__test__bean", {
    content: { en: "after" },
    relations: [{ kind: "mentions", ref: "bean:x" }],
  });

  const stored = await db.collection("beans").findOne({ slug: "__test__bean" });
  assert.deepEqual(stored?.content, { en: "after" });
  assert.deepEqual(stored?.relations, [{ kind: "mentions", ref: "bean:x" }]);
  // The fields a bean's content save must never disturb.
  assert.equal(stored?.visibility, "private");
  assert.equal(stored?.description, "d");
  assert.equal(stored?.keyword, "k");
  assert.deepEqual(stored?.tags, ["t"]);
  assert.deepEqual(stored?.cover, { url: "https://example.test/c.png", provider: "cloudinary" });
});

test("the container writers reach plants and pods, leaving visibility alone", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("plants").insertOne({
    slug: "__test__p", name: "P", natures: ["work"], role: { kind: "owner" as const }, description: "d", visibility: "public",
  });
  await db.collection("pods").insertOne({
    slug: "__test__d", name: "D", description: "d", visibility: "private",
  });

  await updatePlantContent("__test__p", { content: "plant prose", relations: [] });
  await updatePodContent("__test__d", { content: "pod prose", relations: [] });

  const plant = await db.collection("plants").findOne({ slug: "__test__p" });
  const pod = await db.collection("pods").findOne({ slug: "__test__d" });
  assert.equal(plant?.content, "plant prose");
  assert.equal(plant?.visibility, "public");
  assert.equal(plant?.description, "d");
  assert.equal(pod?.content, "pod prose");
  assert.equal(pod?.visibility, "private");
});

test("updateSproutAnchor writes about and unsets parents, or writes a plant parent and unsets about", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("sprouts").insertOne({
    slug: "__test__anchor", name: "S", kind: "log", date: "2026-10-10", description: "",
    parents: ["plant:__test__p"], state: "draft", media: [], source: { kind: "manual" },
  });

  await updateSproutAnchor("__test__anchor", { about: ["bean:__test__b", "pod:__test__pod"] });
  let doc = await db.collection("sprouts").findOne({ slug: "__test__anchor" }, { projection: { _id: 0 } });
  assert.deepEqual(doc!.about, ["bean:__test__b", "pod:__test__pod"]);
  assert.equal("parents" in doc!, false);

  await updateSproutAnchor("__test__anchor", { plant: "__test__p2" });
  doc = await db.collection("sprouts").findOne({ slug: "__test__anchor" }, { projection: { _id: 0 } });
  assert.deepEqual(doc!.parents, ["plant:__test__p2"]);
  assert.equal("about" in doc!, false);
  // Everything else untouched.
  assert.equal(doc!.state, "draft");
  assert.equal(doc!.kind, "log");
});

test("updateSproutKind writes kind and nothing else", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("sprouts").insertOne({
    slug: "__test__kind", name: "S", kind: "log", date: "2026-10-10", description: "",
    about: ["bean:__test__b"], state: "private", media: [], source: { kind: "manual" },
  });
  await updateSproutKind("__test__kind", "decision");
  const doc = await db.collection("sprouts").findOne({ slug: "__test__kind" }, { projection: { _id: 0 } });
  assert.equal(doc!.kind, "decision");
  assert.equal(doc!.state, "private");
  assert.deepEqual(doc!.about, ["bean:__test__b"]);
});

// Release the cached Mongo connection so the runner exits instead of hanging
// on an open socket for ten minutes (issue #75).
test.after(async () => {
  if (hasDb) await closeDb();
});
