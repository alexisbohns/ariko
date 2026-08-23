import { test } from "node:test";
import assert from "node:assert/strict";
import {
  updateSproutContent,
  updatePlantContent,
  updatePodContent,
} from "./botanical";
import { getDb } from "./db";

const hasDb = Boolean(process.env.MONGODB_URI);

async function cleanup() {
  const db = await getDb();
  await db.collection("plants").deleteMany({ slug: /^__test__/ });
  await db.collection("pods").deleteMany({ slug: /^__test__/ });
  await db.collection("sprouts").deleteMany({ slug: /^__test__/ });
}

test("a content write touches content and relations and NOTHING else", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("sprouts").insertOne({
    slug: "__test__s",
    name: "S",
    type: "article",
    date: "2026-08-23",
    description: "keep me",
    parents: ["bean:__test__b"],
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
  assert.equal(stored?.type, "article");
  assert.deepEqual(stored?.parents, ["bean:__test__b"]);
  assert.equal((stored?.media as unknown[])?.length, 1);
  assert.deepEqual(stored?.source, { kind: "manual" });
});

test("the container writers reach plants and pods, leaving visibility alone", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("plants").insertOne({
    slug: "__test__p", name: "P", natures: ["work"], description: "d", visibility: "public",
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
