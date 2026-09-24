import { test } from "node:test";
import assert from "node:assert/strict";
import { parseManifest } from "./garden-manifest";
import { planGarden } from "./garden-plan";
import { applyPlan } from "./plant-garden-apply";
import { ensureBotanicalIndexes } from "./botanical";
import { loadRawGarden } from "./store";
import { getDb, closeDb } from "./db";

/**
 * The planting flow END TO END against a real database:
 * `parseManifest` → `planGarden` → `applyPlan` → `loadRawGarden`.
 *
 * Nothing here hand-builds a manifest object or a plan. Every rule the pieces
 * claim (privacy at birth, upward parentage, bilingual content, an idempotent
 * second run, a narrow `--update`) is only true of the COMPOSITION — each half
 * typechecks in isolation while the pair quietly writes the wrong document —
 * so the test drives the same four calls `scripts/plant-garden.ts` does.
 */

const hasDb = Boolean(process.env.MONGODB_URI);

/**
 * Every slug this file creates is prefixed `test-krabs`, which is what makes
 * this regex safe to run against a scratch database: it can only ever match
 * documents this file wrote.
 */
async function cleanup() {
  const db = await getDb();
  await db.collection("pods").deleteMany({ slug: /^test-krabs/ });
  await db.collection("beans").deleteMany({ slug: /^test-krabs/ });
  await db.collection("sprouts").deleteMany({ slug: /^test-krabs/ });
}

function manifestYaml(narrativeEn: string, narrativeFr: string): string {
  return `
pod:
  slug: test-krabs
  name: { en: Krabs, fr: Krabs }
  plant: null
  description: { en: A small ledger., fr: Un petit registre. }
  content: { en: ${narrativeEn}, fr: ${narrativeFr} }
beans:
  - slug: test-krabs-import
    name: { en: Import, fr: Import }
    description: { en: Bringing data in., fr: Faire entrer les données. }
    sprouts:
      - slug: test-krabs-import-intro
        type: note
        date: 2026-09-13
        name: { en: Intro, fr: Intro }
        description: { en: First note., fr: Première note. }
        content: { en: Body., fr: Corps. }
`;
}

/** One full CLI pass: parse, plan against a freshly read garden, apply. */
async function plant(yaml: string, update: boolean): Promise<void> {
  const parsed = parseManifest(yaml);
  assert.equal(parsed.ok, true, parsed.ok ? "" : parsed.error);
  if (!parsed.ok) return;
  const garden = await loadRawGarden();
  const slugs = { pods: garden.pods ?? [], beans: garden.beans ?? [], sprouts: garden.sprouts ?? [] };
  await applyPlan(planGarden(parsed.manifest, slugs, { update }), slugs);
}

async function readTree() {
  const db = await getDb();
  return {
    pod: await db.collection("pods").findOne({ slug: "test-krabs" }),
    bean: await db.collection("beans").findOne({ slug: "test-krabs-import" }),
    sprout: await db.collection("sprouts").findOne({ slug: "test-krabs-import-intro" }),
  };
}

test("planting creates the tree private, parented upward, bilingual", { skip: !hasDb }, async (t) => {
  await ensureBotanicalIndexes();
  await cleanup();
  t.after(cleanup);

  await plant(manifestYaml("The narrative.", "Le récit."), false);
  const { pod, bean, sprout } = await readTree();

  assert.ok(pod && bean && sprout, "all three tiers were written");

  // Parentage points UPWARD, from the manifest's own nesting. The read path
  // tolerates a missing or dangling parent by simply not listing the child, so
  // a bean written with `parents: []` would sit in Mongo, valid, and be
  // permanently absent from the pod page that is supposed to list it — with
  // nothing anywhere reporting it.
  assert.deepEqual(pod.parents, []);
  assert.deepEqual(bean.parents, ["pod:test-krabs"]);
  assert.deepEqual(sprout.parents, ["bean:test-krabs-import"]);

  // THE MOST IMPORTANT ASSERTION IN THIS FILE. A manifest is a text file in
  // ANOTHER repo; it must not be able to publish. A sprout's `state` cascades
  // upward through its bean, pod and plant, so a single `"published"` here
  // would put a sibling repo's content on the public site with one command and
  // no confirmation anywhere.
  assert.equal(pod.visibility, "private");
  assert.equal(bean.visibility, "private");
  assert.notEqual(sprout.state, "published");

  // Bilingual content survived AS bilingual. `buildContentPatch` is the
  // editor's per-half door: one call writes ONE named half and carries the
  // other back verbatim, so a single call can never produce both halves at
  // once. Planting a manifest through it would lose whichever half that one
  // call did not name — the reason `contentPatch` composes both halves
  // directly instead.
  assert.deepEqual(pod.content, { en: "The narrative.", fr: "Le récit." });
});

test("a second run without --update writes nothing", { skip: !hasDb }, async (t) => {
  await ensureBotanicalIndexes();
  await cleanup();
  t.after(cleanup);

  await plant(manifestYaml("The narrative.", "Le récit."), false);
  const db = await getDb();
  const count = async () =>
    (await db.collection("pods").countDocuments({ slug: /^test-krabs/ })) +
    (await db.collection("beans").countDocuments({ slug: /^test-krabs/ })) +
    (await db.collection("sprouts").countDocuments({ slug: /^test-krabs/ }));
  const before = await count();

  // Re-planting the same file is the commonest thing an author does. Without
  // the `skip` verb the second pass would either duplicate the tree or
  // re-assert every field — including the parentage and privacy a human may
  // have changed in the admin since.
  await plant(manifestYaml("The narrative.", "Le récit."), false);

  assert.equal(await count(), before);
  const { pod } = await readTree();
  assert.deepEqual(pod?.content, { en: "The narrative.", fr: "Le récit." });
});

test("--update rewrites content but never parentage or visibility", { skip: !hasDb }, async (t) => {
  await ensureBotanicalIndexes();
  await cleanup();
  t.after(cleanup);

  await plant(manifestYaml("The narrative.", "Le récit."), false);
  await plant(manifestYaml("A revised narrative.", "Un récit révisé."), true);

  const { pod } = await readTree();
  assert.deepEqual(pod?.content, { en: "A revised narrative.", fr: "Un récit révisé." });

  // `--update` touches `name`, `description` and `content` ONLY. Re-homing an
  // entity or flipping its visibility are admin decisions with a privacy
  // cascade behind them; an update path that re-asserted every field would
  // perform both on the next routine re-plant, silently.
  assert.deepEqual(pod?.parents, []);
  assert.equal(pod?.visibility, "private");
});

test("--update preserves hand-authored relations", { skip: !hasDb }, async (t) => {
  await ensureBotanicalIndexes();
  await cleanup();
  t.after(cleanup);

  await plant(manifestYaml("The narrative.", "Le récit."), false);

  const db = await getDb();
  await db
    .collection("pods")
    .updateOne(
      { slug: "test-krabs" },
      { $set: { relations: [{ kind: "evolves-from", ref: "pod:something" }] } },
    );

  await plant(manifestYaml("A revised narrative.", "Un récit révisé."), true);

  const { pod } = await readTree();
  // `mergeMirrored` keeps only the NON-mirrored kinds of what it is GIVEN —
  // `embeds` and `mentions` are derived from the body and re-computed, every
  // other kind is hand-authored and must survive. Passing `undefined` for the
  // existing relations (the shape the unreviewed-article door uses, and is
  // right to use) deletes every hand-authored relation on the entity with
  // nothing failing anywhere. That bug has been here once already.
  assert.deepEqual(pod?.relations, [{ kind: "evolves-from", ref: "pod:something" }]);
});

// The house pattern for a DB-backed file: the pooled client is a live handle,
// so without this the runner reports four passes and then never exits —
// hanging `npm run test:db`, which runs these files serially.
test("close the shared Mongo pool", async () => {
  if (hasDb) await closeDb();
});
