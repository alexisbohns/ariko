// Slice 1 PR2 re-tiering: plants + bees, applied to BOTH data/garden.yml and
// Mongo through the same pure transform (lib/retier.ts).
// Usage: npm run migrate:retier [-- --dry-run]
// Operator sequence: `npm run validators` first (collections are born
// validated), then `migrate:retier -- --dry-run`, review the plan, run for
// real, then dry-run again expecting all no-ops.
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
  // 1) garden.yml — the transform the tests cover; the dump-back happens LAST,
  // after the Mongo half succeeds, so a connection failure has zero side effects.
  const path = join(process.cwd(), "data", "garden.yml");
  const before = (yaml.load(readFileSync(path, "utf8"), { schema: yaml.CORE_SCHEMA }) as RawGarden) ?? {};
  const after = retierGarden(before);
  console.log(
    `${DRY ? "[dry] " : ""}garden.yml: ${after.plants?.length ?? 0} plants, ${after.pods?.length ?? 0} pods, ` +
      `${after.beans?.length ?? 0} beans, ${after.sprouts?.length ?? 0} sprouts, ${after.bees?.length ?? 0} bees`,
  );

  // 2) Mongo — same transform against the live collections, diffed per doc so
  // an idempotent re-run logs no writes. Ordered so every intermediate state
  // stays readable if interrupted: plants exist before beans point at them, and
  // absorbed pods are deleted only after nothing references them anymore.
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

  const plantSlugsBefore = new Set((raw.plants ?? []).map((p) => p.slug));
  for (const p of out.plants ?? []) {
    if (plantSlugsBefore.has(p.slug)) {
      console.log(`${DRY ? "[dry] " : ""}plant ${p.slug} already present`);
      continue;
    }
    console.log(`${DRY ? "[dry] " : ""}insert plant ${p.slug}`);
    if (!DRY) {
      await db.collection("plants").updateOne(
        { slug: p.slug },
        { $setOnInsert: { ...p, visibility: p.visibility ?? "public" } },
        { upsert: true },
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
    // Guarded spreads so an edge-case doc can never get parents/relations: null.
    const set = {
      ...(s.parents !== undefined ? { parents: s.parents } : {}),
      ...(s.relations !== undefined ? { relations: s.relations } : {}),
    };
    if (Object.keys(set).length === 0) continue;
    console.log(`${DRY ? "[dry] " : ""}retier refs on sprout ${s.slug}`);
    if (!DRY) await db.collection("sprouts").updateOne({ slug: s.slug }, { $set: set });
  }

  const podsBefore = new Map((raw.pods ?? []).map((p) => [p.slug, p]));
  for (const p of out.pods ?? []) {
    const prev = podsBefore.get(p.slug);
    const parentsChanged = !prev || JSON.stringify(prev.parents) !== JSON.stringify(p.parents);
    const hasDomain = prev !== undefined && "domain" in prev;
    if (!parentsChanged && !hasDomain) continue;
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

  // Absorbed pods go LAST among the content tiers: by now their beans/sprouts
  // already point at plants, so nothing dangles if a step above crashed.
  const keptPodSlugs = new Set((out.pods ?? []).map((p) => p.slug));
  for (const p of raw.pods ?? []) {
    if (keptPodSlugs.has(p.slug)) continue;
    console.log(`${DRY ? "[dry] " : ""}remove pod ${p.slug} (absorbed into its plant)`);
    if (!DRY) await db.collection("pods").deleteOne({ slug: p.slug });
  }

  const beeSlugsBefore = new Set((raw.bees ?? []).map((b) => b.slug));
  for (const bee of out.bees ?? []) {
    if (beeSlugsBefore.has(bee.slug)) {
      console.log(`${DRY ? "[dry] " : ""}bee ${bee.slug} already present`);
      continue;
    }
    console.log(`${DRY ? "[dry] " : ""}insert bee ${bee.slug}`);
    if (!DRY) {
      await db.collection("bees").updateOne(
        { slug: bee.slug },
        { $setOnInsert: { ...bee, visibility: bee.visibility ?? "private" } },
        { upsert: true },
      );
    }
  }

  // Stored seeds suggesting a now-promoted pod: the suggestion climbs a tier.
  // $rename assumes no doc carries BOTH keys — pre-migration seeds cannot have
  // plantSlug (the inbox only writes it post-PR2), so nothing canonical is overwritten.
  const catalog = [...PROMOTED.map((d) => d.slug), ...CREATED.map((d) => d.slug)];
  const filter = { "suggested.podSlug": { $in: catalog } };
  const n = await db.collection("seeds").countDocuments(filter);
  console.log(`${DRY ? "[dry] " : ""}retier suggested.podSlug -> plantSlug on ${n} seeds`);
  if (!DRY && n > 0) {
    await db.collection("seeds").updateMany(filter, { $rename: { "suggested.podSlug": "suggested.plantSlug" } });
  }

  await closeDb();

  // 3) garden.yml write — only once the Mongo half is fully through.
  if (!DRY) writeFileSync(path, yaml.dump(after, { lineWidth: 100 }), "utf8");

  console.log(DRY ? "[dry] done — re-run without --dry-run to apply" : "done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
