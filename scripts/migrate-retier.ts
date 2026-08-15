// Slice 1 PR2 re-tiering: plants + bees, applied to BOTH data/garden.yml and
// Mongo through the same pure transform (lib/retier.ts).
// Usage: npm run migrate:retier [-- --dry-run]
// Idempotent: a re-run is a no-op on both halves. Plants and bees are written
// with $setOnInsert only, so an admin-flipped visibility survives a re-run.
// Run together with the deploy of the PR2 merge (old code reads pods+domain,
// new code reads plants — same coupling as PR1's migrate:botanical).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { getDb, closeDb } from "../lib/db";
import { retierGarden, PROMOTED, CREATED } from "../lib/retier";
import type { Bean, Bee, Plant, Pod, RawGarden, Sprout } from "../lib/data";

const DRY = process.argv.includes("--dry-run");

async function main() {
  // 1) garden.yml — the transform the tests cover, dumped back.
  const path = join(process.cwd(), "data", "garden.yml");
  const before = (yaml.load(readFileSync(path, "utf8"), { schema: yaml.CORE_SCHEMA }) as RawGarden) ?? {};
  const after = retierGarden(before);
  console.log(
    `${DRY ? "[dry] " : ""}garden.yml: ${after.plants?.length ?? 0} plants, ${after.pods?.length ?? 0} pods, ` +
      `${after.beans?.length ?? 0} beans, ${after.sprouts?.length ?? 0} sprouts, ${after.bees?.length ?? 0} bees`,
  );
  if (!DRY) writeFileSync(path, yaml.dump(after, { lineWidth: 100 }), "utf8");

  // 2) Mongo — same transform against the live collections, diffed per doc.
  // Projections strip _id so catalog-derived docs never carry one and the
  // YAML/Mongo halves see identical shapes.
  const db = await getDb();
  const noId = { projection: { _id: 0 } };
  const raw: RawGarden = {
    plants: await db.collection<Plant>("plants").find({}, noId).toArray(),
    pods: await db.collection<Pod>("pods").find({}, noId).toArray(),
    beans: await db.collection<Bean>("beans").find({}, noId).toArray(),
    sprouts: await db.collection<Sprout>("sprouts").find({}, noId).toArray(),
    bees: await db.collection<Bee>("bees").find({}, noId).toArray(),
  };
  const out = retierGarden(raw);

  for (const p of out.plants ?? []) {
    console.log(`${DRY ? "[dry] " : ""}upsert plant ${p.slug}`);
    if (!DRY) {
      await db.collection("plants").updateOne(
        { slug: p.slug },
        { $setOnInsert: { ...p, visibility: p.visibility ?? "public" } },
        { upsert: true },
      );
    }
  }

  const keptPodSlugs = new Set((out.pods ?? []).map((p) => p.slug));
  for (const p of raw.pods ?? []) {
    if (keptPodSlugs.has(p.slug)) continue;
    console.log(`${DRY ? "[dry] " : ""}remove pod ${p.slug} (absorbed into its plant)`);
    if (!DRY) await db.collection("pods").deleteOne({ slug: p.slug });
  }
  for (const p of out.pods ?? []) {
    console.log(`${DRY ? "[dry] " : ""}retier pod ${p.slug}`);
    if (!DRY) {
      await db.collection("pods").updateOne(
        { slug: p.slug },
        {
          ...(p.parents && p.parents.length > 0 ? { $set: { parents: p.parents } } : {}),
          $unset: { domain: "" },
        },
      );
    }
  }

  const beansBefore = new Map((raw.beans ?? []).map((b) => [b.slug, b]));
  for (const b of out.beans ?? []) {
    const prev = beansBefore.get(b.slug);
    if (prev && JSON.stringify(prev.parents) === JSON.stringify(b.parents)) continue;
    console.log(`${DRY ? "[dry] " : ""}re-parent bean ${b.slug} -> ${JSON.stringify(b.parents)}`);
    if (!DRY) await db.collection("beans").updateOne({ slug: b.slug }, { $set: { parents: b.parents } });
  }

  const sproutsBefore = new Map((raw.sprouts ?? []).map((s) => [s.slug, s]));
  for (const s of out.sprouts ?? []) {
    const prev = sproutsBefore.get(s.slug);
    const parentsChanged = !prev || JSON.stringify(prev.parents) !== JSON.stringify(s.parents);
    const relationsChanged = prev && JSON.stringify(prev.relations) !== JSON.stringify(s.relations);
    if (!parentsChanged && !relationsChanged) continue;
    console.log(`${DRY ? "[dry] " : ""}retier refs on sprout ${s.slug}`);
    if (!DRY) {
      await db.collection("sprouts").updateOne(
        { slug: s.slug },
        {
          $set: {
            parents: s.parents,
            ...(s.relations !== undefined ? { relations: s.relations } : {}),
          },
        },
      );
    }
  }

  for (const bee of out.bees ?? []) {
    console.log(`${DRY ? "[dry] " : ""}upsert bee ${bee.slug}`);
    if (!DRY) {
      await db.collection("bees").updateOne(
        { slug: bee.slug },
        { $setOnInsert: { ...bee, visibility: bee.visibility ?? "private" } },
        { upsert: true },
      );
    }
  }

  // Stored seeds suggesting a now-promoted pod: the suggestion climbs a tier.
  const catalog = [...PROMOTED.map((d) => d.slug), ...CREATED.map((d) => d.slug)];
  const filter = { "suggested.podSlug": { $in: catalog } };
  const n = await db.collection("seeds").countDocuments(filter);
  console.log(`${DRY ? "[dry] " : ""}retier suggested.podSlug -> plantSlug on ${n} seeds`);
  if (!DRY && n > 0) {
    await db.collection("seeds").updateMany(filter, { $rename: { "suggested.podSlug": "suggested.plantSlug" } });
  }

  await closeDb();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
