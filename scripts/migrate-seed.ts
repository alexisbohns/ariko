// One-time baseline migration: imports data/seed.yml into Mongo. Authored
// `state`/`visibility` values in the seed are always respected; when the seed
// omits them, the public/published defaults are applied via $setOnInsert — i.e.
// on FIRST insert only — so a re-run never clobbers state/visibility that was
// since changed through the admin (an un-publish must survive a re-migrate).
// Retire this once content is authored through the admin instead of seed.yml.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { getDb } from "../lib/db";
import type { RawSeed } from "../lib/data";

async function main() {
  const file = readFileSync(join(process.cwd(), "data", "seed.yml"), "utf8");
  // CORE_SCHEMA keeps dates as plain YYYY-MM-DD strings.
  const raw = (yaml.load(file, { schema: yaml.CORE_SCHEMA }) as RawSeed) ?? {};
  const db = await getDb();

  await db.collection("molecules").createIndex({ slug: 1 }, { unique: true });
  await db.collection("atoms").createIndex({ slug: 1 }, { unique: true });
  await db.collection("versions").createIndex({ slug: 1 }, { unique: true });

  for (const m of raw.molecules ?? []) {
    await db.collection("molecules").updateOne(
      { slug: m.slug },
      m.visibility
        ? { $set: { ...m } }
        : { $set: { ...m }, $setOnInsert: { visibility: "public" } },
      { upsert: true },
    );
  }
  for (const a of raw.atoms ?? []) {
    await db.collection("atoms").updateOne(
      { slug: a.slug },
      a.visibility
        ? { $set: { ...a } }
        : { $set: { ...a }, $setOnInsert: { visibility: "public" } },
      { upsert: true },
    );
  }
  for (const v of raw.versions ?? []) {
    await db.collection("versions").updateOne(
      { slug: v.slug },
      v.state ? { $set: { ...v } } : { $set: { ...v }, $setOnInsert: { state: "published" } },
      { upsert: true },
    );
  }

  console.log(
    `Migrated ${raw.molecules?.length ?? 0} molecules, ${raw.atoms?.length ?? 0} atoms, ${raw.versions?.length ?? 0} versions.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
