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
  "a fresh post creates the bean carrying the article as its narrative, plus the container narrative — and no sprout",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    const db = await getDb();
    await db.collection("plants").insertOne({
      slug: "__test__p",
      name: "P",
      natures: ["work"], role: { kind: "owner" as const },
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
    assert.deepEqual(bean?.parents, ["plant:__test__p"]);
    // An article IS the bean's narrative (journal model §3 "Doors"): content
    // lands on the bean, with its refs mirrored into relations.
    assert.equal(bean?.content, "body");
    assert.deepEqual(bean?.relations, []);
    // `date` is validated and recorded nowhere — a bean has no date.
    assert.equal(bean?.date, undefined);

    // The pre-journal shape — a `type:"article"` sprout `<slug>-0` under the
    // bean — is what migrate:journal folds away; the door must not recreate it.
    assert.equal(await db.collection("sprouts").findOne({ slug: "__test__a-0" }), null);
    assert.equal(await db.collection("sprouts").countDocuments({ parents: "bean:__test__a" }), 0);

    const plant = await db.collection("plants").findOne({ slug: "__test__p" });
    assert.deepEqual(plant?.relations, [{ kind: "embeds", ref: "bean:__test__a" }]);
  },
);

test("a re-post to a still-private bean rewrites its narrative in place", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("plants").insertOne({
    slug: "__test__p",
    name: "P",
    natures: ["work"], role: { kind: "owner" as const },
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

  const beans = await db.collection("beans").find({ slug: "__test__a" }).toArray();
  assert.equal(beans.length, 1);
  assert.equal(beans[0].content, "second");
  assert.equal(beans[0].visibility, "private");
  assert.equal(await db.collection("sprouts").countDocuments({ slug: /^__test__/ }), 0);
});

test(
  "a published bean carrying a narrative is refused, untouched, and nothing in the batch is written",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    const db = await getDb();
    await db.collection("plants").insertOne({
      slug: "__test__p",
      name: "P",
      natures: ["work"], role: { kind: "owner" as const },
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
    // Simulate a human reviewing and publishing the bean in the admin.
    await db
      .collection("beans")
      .updateOne({ slug: "__test__a" }, { $set: { visibility: "public" } });

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
    assert.deepEqual(result, { ok: false, refused: ["bean:__test__a"] });

    const bean = await db.collection("beans").findOne({ slug: "__test__a" });
    assert.equal(bean?.content, "original");
    assert.equal(bean?.visibility, "public");

    const other = await db.collection("beans").findOne({ slug: "__test__b" });
    assert.equal(other, null);
  },
);

test("a public container carrying prose is refused", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("plants").insertOne({
    slug: "__test__pub",
    name: "Pub",
    natures: ["work"], role: { kind: "owner" as const },
    description: "",
    visibility: "public",
    content: "already live",
  });

  const result = await writeArticles({
    container: "plant:__test__pub",
    narrative: "new prose",
  });
  assert.deepEqual(result, { ok: false, refused: ["plant:__test__pub"] });

  // Not just the return value: the refusal must be honored on disk too — a
  // regression that started writing on the refusal path would still pass an
  // assertion that only checks the result.
  const plant = await db.collection("plants").findOne({ slug: "__test__pub" });
  assert.equal(plant?.content, "already live");
  assert.equal(plant?.relations, undefined);
});

test(
  "refusals accumulate: a missing container and a published bean are both reported, and nothing is written",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    const db = await getDb();
    // A bean a human already reviewed and published — no container in this
    // collection has to exist for this row to exist.
    await db.collection("beans").insertOne({
      slug: "__test__c",
      name: "C",
      description: "",
      parents: ["plant:__test__missing"],
      content: "reviewed content",
      visibility: "public",
    });

    const result = await writeArticles({
      container: "plant:__test__missing",
      narrative: "hello",
      articles: [
        { slug: "__test__c", name: "C", description: "", date: "2026-07-24", content: "attempt" },
      ],
    });
    // Both refusals surface in one response — the missing-container check
    // does not short-circuit before the bean-visibility check runs.
    assert.deepEqual(result, {
      ok: false,
      refused: ["plant:__test__missing (unknown)", "bean:__test__c"],
    });

    assert.equal(await db.collection("plants").findOne({ slug: "__test__missing" }), null);
    const bean = await db.collection("beans").findOne({ slug: "__test__c" });
    assert.equal(bean?.content, "reviewed content");
    assert.equal(bean?.visibility, "public");
    assert.equal(await db.collection("sprouts").findOne({ slug: "__test__c-0" }), null);
  },
);

test(
  "a public container with blank string content still accepts a narrative (the write-time filter, not just the pre-check, must agree)",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    const db = await getDb();
    await db.collection("plants").insertOne({
      slug: "__test__blankpub",
      name: "BlankPub",
      natures: ["work"], role: { kind: "owner" as const },
      description: "",
      visibility: "public",
      content: "",
    });

    const result = await writeArticles({
      container: "plant:__test__blankpub",
      narrative: "first prose",
    });
    assert.deepEqual(result, { ok: true, written: 0, narrative: true });
    const plant = await db.collection("plants").findOne({ slug: "__test__blankpub" });
    assert.equal(plant?.content, "first prose");
  },
);

test(
  "a public container with blank LOCALIZED content still accepts a narrative (the write-time filter's object branch)",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    const db = await getDb();
    await db.collection("plants").insertOne({
      slug: "__test__blankloc",
      name: "BlankLoc",
      natures: ["work"], role: { kind: "owner" as const },
      description: "",
      visibility: "public",
      content: { en: "", fr: "" },
    });

    const result = await writeArticles({
      container: "plant:__test__blankloc",
      narrative: "first prose",
    });
    assert.deepEqual(result, { ok: true, written: 0, narrative: true });
    const plant = await db.collection("plants").findOne({ slug: "__test__blankloc" });
    assert.equal(plant?.content, "first prose");
  },
);

test(
  "a public existing bean is refused, and its name, description and narrative are untouched",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    const db = await getDb();
    await db.collection("plants").insertOne({
      slug: "__test__p",
      name: "P",
      natures: ["work"], role: { kind: "owner" as const },
      description: "",
      visibility: "private",
    });
    // A bean a human already reviewed and published — this door must never
    // have created it public itself ($setOnInsert always writes private).
    await db.collection("beans").insertOne({
      slug: "__test__pubbean",
      name: "Original Name",
      description: "Original description.",
      parents: ["plant:__test__p"],
      content: "Original narrative.",
      visibility: "public",
    });

    const result = await writeArticles({
      container: "plant:__test__p",
      articles: [
        {
          slug: "__test__pubbean",
          name: "Overwritten Name",
          description: "Overwritten description.",
          date: "2026-07-24",
          content: "attempted overwrite",
        },
      ],
    });
    assert.deepEqual(result, { ok: false, refused: ["bean:__test__pubbean"] });

    const bean = await db.collection("beans").findOne({ slug: "__test__pubbean" });
    assert.equal(bean?.name, "Original Name");
    assert.equal(bean?.description, "Original description.");
    assert.equal(bean?.content, "Original narrative.");
    assert.equal(bean?.visibility, "public");
    assert.equal(await db.collection("sprouts").countDocuments({ slug: /^__test__/ }), 0);
  },
);

test(
  "a private existing bean is still updated in place (the re-post case keeps working)",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    const db = await getDb();
    await db.collection("plants").insertOne({
      slug: "__test__p",
      name: "P",
      natures: ["work"], role: { kind: "owner" as const },
      description: "",
      visibility: "private",
    });
    await db.collection("beans").insertOne({
      slug: "__test__privbean",
      name: "Draft Name",
      description: "Draft description.",
      parents: ["plant:__test__p"],
      visibility: "private",
    });

    const result = await writeArticles({
      container: "plant:__test__p",
      articles: [
        {
          slug: "__test__privbean",
          name: "Updated Name",
          description: "Updated description.",
          date: "2026-07-24",
          content: "body",
        },
      ],
    });
    assert.deepEqual(result, { ok: true, written: 1, narrative: false });

    const bean = await db.collection("beans").findOne({ slug: "__test__privbean" });
    assert.equal(bean?.name, "Updated Name");
    assert.equal(bean?.description, "Updated description.");
    assert.equal(bean?.content, "body");
    assert.equal(bean?.visibility, "private");
    // The hand-authored bean's parentage is not re-asserted by the re-post.
    assert.deepEqual(bean?.parents, ["plant:__test__p"]);
  },
);

test(
  "a public-bean refusal accumulates alongside a projected-bean refusal in one response",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    const db = await getDb();
    await db.collection("plants").insertOne({
      slug: "__test__p",
      name: "P",
      natures: ["work"], role: { kind: "owner" as const },
      description: "",
      visibility: "private",
    });
    await db.collection("beans").insertOne({
      slug: "__test__pubbean2",
      name: "Original",
      description: "",
      parents: ["plant:__test__p"],
      visibility: "public",
    });
    // A projected bean is machine-owned (lib/projected-beans.ts): a narrative
    // written onto it would be lost on the next rebuild from its feed.
    await db.collection("beans").insertOne({
      slug: "__test__reviewed",
      name: "Projected",
      parents: ["plant:__test__p"],
      visibility: "private",
      projected: { source: "arkaik", feedId: "feed-1", firstPollenId: "p-1" },
    });

    const result = await writeArticles({
      container: "plant:__test__p",
      articles: [
        {
          slug: "__test__pubbean2",
          name: "Overwrite",
          description: "",
          date: "2026-07-24",
          content: "attempt",
        },
        {
          slug: "__test__reviewed",
          name: "Reviewed",
          description: "",
          date: "2026-07-24",
          content: "attempt",
        },
      ],
    });
    assert.deepEqual(result, {
      ok: false,
      refused: ["bean:__test__pubbean2", "bean:__test__reviewed (projected)"],
    });
    const projected = await db.collection("beans").findOne({ slug: "__test__reviewed" });
    assert.equal(projected?.content, undefined);
  },
);

test("a bean: container takes a narrative; public-with-prose and projected beans are refused", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("beans").insertOne({
    slug: "__test__bean",
    name: "Bean",
    parents: ["plant:__test__p"],
    visibility: "private",
  });

  const first = await writeArticles({
    container: "bean:__test__bean",
    narrative: { en: "hello :entity[other]{ref=bean:__test__other}" },
  });
  assert.deepEqual(first, { ok: true, written: 0, narrative: true });

  const bean = await db.collection("beans").findOne({ slug: "__test__bean" });
  assert.equal(bean?.content?.en, "hello :entity[other]{ref=bean:__test__other}");
  assert.ok(Array.isArray(bean?.relations));
  assert.ok(
    bean!.relations.some((r: { kind: string; ref: string }) => r.kind === "mentions" && r.ref === "bean:__test__other"),
    JSON.stringify(bean!.relations),
  );
  // This door publishes nothing: the bean stays as private as it was born.
  assert.equal(bean?.visibility, "private");

  // Once a human has published it, its prose is reviewed work — refused, and
  // honored on disk, exactly as a plant or pod would be.
  await db.collection("beans").updateOne({ slug: "__test__bean" }, { $set: { visibility: "public" } });
  const second = await writeArticles({ container: "bean:__test__bean", narrative: "rewrite" });
  assert.deepEqual(second, { ok: false, refused: ["bean:__test__bean"] });
  const after = await db.collection("beans").findOne({ slug: "__test__bean" });
  assert.equal(after?.content?.en, "hello :entity[other]{ref=bean:__test__other}");

  // A projected bean is machine-owned and rebuildable from its feed; a
  // narrative written onto it would be lost on the next rebuild.
  await db.collection("beans").insertOne({
    slug: "__test__projected",
    name: "Projected",
    parents: ["plant:__test__p"],
    visibility: "private",
    projected: { source: "arkaik", feedId: "feed-1", firstPollenId: "p-1" },
  });
  const third = await writeArticles({ container: "bean:__test__projected", narrative: "hello" });
  assert.deepEqual(third, { ok: false, refused: ["bean:__test__projected (projected)"] });
  const projected = await db.collection("beans").findOne({ slug: "__test__projected" });
  assert.equal(projected?.content, undefined);
});

test("the store refuses articles under a bean on its own, and writes nothing", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("beans").insertOne({
    slug: "__test__holder",
    name: "Holder",
    parents: ["plant:__test__p"],
    visibility: "private",
  });

  // Bypasses validateArticlesPayload deliberately: the route would have
  // refused this shape already, and the store must not depend on that.
  const result = await writeArticles({
    container: "bean:__test__holder",
    narrative: "prose",
    articles: [{ slug: "__test__under", name: "U", date: "2026-07-24", content: "body" }],
  });
  assert.deepEqual(result, { ok: false, refused: ["bean:__test__holder (a bean holds no beans)"] });

  const holder = await db.collection("beans").findOne({ slug: "__test__holder" });
  assert.equal(holder?.content, undefined);
  assert.equal(await db.collection("beans").findOne({ slug: "__test__under" }), null);
});

test.after(async () => {
  if (hasDb) await closeDb();
});

// --- Bilingual door (#53) -------------------------------------------------

test("writes a bilingual narrative and bilingual articles verbatim", { skip: !hasDb }, async () => {
  const db = await getDb();
  const slug = "__test__bi";
  await db.collection("plants").updateOne(
    { slug },
    { $set: { slug, name: "T", description: "d", natures: ["work"], role: { kind: "owner" }, visibility: "private" } },
    { upsert: true },
  );

  const res = await writeArticles({
    container: `plant:${slug}`,
    narrative: { en: "## Context", fr: "## Contexte" },
    articles: [
      {
        slug: "__test__bi-a",
        name: { en: "Name", fr: "Nom" },
        description: { en: "Desc", fr: "Description" },
        date: "2026-09-03",
        content: { en: "prose", fr: "de la prose" },
      },
    ],
  });
  assert.deepEqual(res, { ok: true, written: 1, narrative: true });

  const plant = await db.collection("plants").findOne({ slug });
  assert.deepEqual(plant?.content, { en: "## Context", fr: "## Contexte" });

  const bean = await db.collection("beans").findOne({ slug: "__test__bi-a" });
  assert.deepEqual(bean?.name, { en: "Name", fr: "Nom" });
  assert.deepEqual(bean?.description, { en: "Desc", fr: "Description" });
  assert.deepEqual(bean?.content, { en: "prose", fr: "de la prose" });
  assert.equal(await db.collection("sprouts").findOne({ slug: "__test__bi-a-0" }), null);

  await cleanup();
});

test("a public container carrying only FR prose is still refused", { skip: !hasDb }, async () => {
  // The refusal is "public AND carries prose", and prose in EITHER language
  // counts: resolveText falls back across parts, and the Mongo-side mirror in
  // containerStillWritableFilter reproduces that fallback.
  const db = await getDb();
  const slug = "__test__frguard";
  await db.collection("plants").updateOne(
    { slug },
    {
      $set: {
        slug, name: "T", description: "d", natures: ["work"],
        role: { kind: "owner" }, visibility: "public",
        content: { fr: "prose fran\u00e7aise" },
      },
    },
    { upsert: true },
  );

  const res = await writeArticles({ container: `plant:${slug}`, narrative: "replacement" });
  assert.equal(res.ok, false);

  const plant = await db.collection("plants").findOne({ slug });
  assert.deepEqual(plant?.content, { fr: "prose fran\u00e7aise" });
  await cleanup();
});
