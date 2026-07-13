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
      { $set: { ...m, visibility: "public" } },
      { upsert: true },
    );
  }
  for (const a of raw.atoms ?? []) {
    await db.collection("atoms").updateOne(
      { slug: a.slug },
      { $set: { ...a, visibility: "public" } },
      { upsert: true },
    );
  }
  for (const v of raw.versions ?? []) {
    await db.collection("versions").updateOne(
      { slug: v.slug },
      { $set: { ...v, state: "published" } },
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
