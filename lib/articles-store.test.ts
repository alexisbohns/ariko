import { test } from "node:test";
import assert from "node:assert/strict";
import { writeArticles } from "./articles-store";
import { getDb, closeDb } from "./db";
import type { ArticlesPayload } from "./articles";

const hasDb = Boolean(process.env.MONGODB_URI);

async function cleanup() {
  const db = await getDb();
  await db.collection("plants").deleteMany({ slug: /^__test__/ });
  await db.collection("pods").deleteMany({ slug: /^__test__/ });
  await db.collection("beans").deleteMany({ slug: /^__test__/ });
  await db.collection("sprouts").deleteMany({ slug: /^__test__/ });
}

test(
  "a fresh post creates the bean, the sprout and the narrative",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    const db = await getDb();
    await db.collection("plants").insertOne({
      slug: "__test__p",
      name: "P",
      natures: ["work"],
      description: "",
      visibility: "private",
    });

    const payload: ArticlesPayload = {
      container: "plant:__test__p",
      narrative: "Some intro.\n::entity{ref=bean:__test__a}",
      articles: [
        {
          slug: "__test__a",
          name: "A",
          description: "One line.",
          date: "2026-07-24",
          content: "body",
        },
      ],
    };
    const result = await writeArticles(payload);
    assert.deepEqual(result, { ok: true, written: 1, narrative: true });

    const bean = await db.collection("beans").findOne({ slug: "__test__a" });
    assert.equal(bean?.visibility, "private");

    const sprout = await db.collection("sprouts").findOne({ slug: "__test__a-0" });
    assert.ok(sprout);
    assert.ok(!("state" in sprout!));
    assert.deepEqual(sprout!.parents, ["bean:__test__a"]);
    assert.equal(sprout!.content, "body");

    const plant = await db.collection("plants").findOne({ slug: "__test__p" });
    assert.deepEqual(plant?.relations, [{ kind: "embeds", ref: "bean:__test__a" }]);
  },
);

test("a re-post updates the sprout in place", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("plants").insertOne({
    slug: "__test__p",
    name: "P",
    natures: ["work"],
    description: "",
    visibility: "private",
  });

  const base: ArticlesPayload = {
    container: "plant:__test__p",
    articles: [
      { slug: "__test__a", name: "A", description: "", date: "2026-07-24", content: "first" },
    ],
  };
  await writeArticles(base);
  await writeArticles({
    ...base,
    articles: [
      { slug: "__test__a", name: "A", description: "", date: "2026-07-24", content: "second" },
    ],
  });

  const sprouts = await db.collection("sprouts").find({ slug: "__test__a-0" }).toArray();
  assert.equal(sprouts.length, 1);
  assert.equal(sprouts[0].content, "second");
});

test(
  "a reviewed sprout is refused and nothing in the batch is written",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    const db = await getDb();
    await db.collection("plants").insertOne({
      slug: "__test__p",
      name: "P",
      natures: ["work"],
      description: "",
      visibility: "private",
    });

    await writeArticles({
      container: "plant:__test__p",
      articles: [
        {
          slug: "__test__a",
          name: "A",
          description: "",
          date: "2026-07-24",
          content: "original",
        },
      ],
    });
    // Simulate a human reviewing and publishing the sprout directly in Mongo.
    await db
      .collection("sprouts")
      .updateOne({ slug: "__test__a-0" }, { $set: { state: "published" } });

    const result = await writeArticles({
      container: "plant:__test__p",
      articles: [
        {
          slug: "__test__a",
          name: "A",
          description: "",
          date: "2026-07-24",
          content: "attempted overwrite",
        },
        {
          slug: "__test__b",
          name: "B",
          description: "",
          date: "2026-07-24",
          content: "new",
        },
      ],
    });
    assert.deepEqual(result, { ok: false, refused: ["__test__a-0"] });

    const sprout = await db.collection("sprouts").findOne({ slug: "__test__a-0" });
    assert.equal(sprout?.content, "original");

    const other = await db.collection("sprouts").findOne({ slug: "__test__b-0" });
    assert.equal(other, null);
  },
);

test("a public container carrying prose is refused", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("plants").insertOne({
    slug: "__test__pub",
    name: "Pub",
    natures: ["work"],
    description: "",
    visibility: "public",
    content: "already live",
  });

  const result = await writeArticles({
    container: "plant:__test__pub",
    narrative: "new prose",
  });
  assert.deepEqual(result, { ok: false, refused: ["plant:__test__pub"] });
});

test.after(async () => {
  if (hasDb) await closeDb();
});
