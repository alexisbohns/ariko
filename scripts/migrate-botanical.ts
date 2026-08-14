// One-shot production migration to botanical collections + prefixes.
// Usage: npm run migrate:botanical [-- --dry-run]
// Idempotent: renames are skipped when already done; ref rewrites are no-ops
// on already-botanical docs. Run together with the deploy of the rename PR:
// old code reads old collections, new code reads new ones.
import { getDb, closeDb } from "../lib/db";

const DRY = process.argv.includes("--dry-run");
const RENAMES: [string, string][] = [
  ["molecules", "pods"],
  ["atoms", "beans"],
  ["versions", "sprouts"],
  ["captures", "seeds"],
];
const ref = (r: string) =>
  r.replace(/^molecule:/, "pod:").replace(/^atom:/, "bean:").replace(/^version:/, "sprout:");

async function main() {
  const db = await getDb();
  const names = new Set((await db.listCollections().toArray()).map((c) => c.name));
  for (const [from, to] of RENAMES) {
    if (!names.has(from)) {
      console.log(`skip ${from} -> ${to} (source absent)`);
      continue;
    }
    if (names.has(to)) {
      // A stray empty target (e.g. created by a test run) must not silently
      // block the rename — that would leave the data stranded in `from`.
      const count = await db.collection(to).estimatedDocumentCount();
      if (count > 0) {
        console.log(`skip ${from} -> ${to} (target exists with ${count} docs)`);
        continue;
      }
      console.log(`${DRY ? "[dry] " : ""}drop empty target ${to}`);
      if (!DRY) await db.collection(to).drop();
    }
    console.log(`${DRY ? "[dry] " : ""}rename ${from} -> ${to}`);
    if (!DRY) await db.renameCollection(from, to);
  }

  // Rewrite prefixed refs inside docs (small data: a loop is fine, idempotent).
  for (const coll of ["beans", "sprouts"]) {
    if (DRY && !(await db.listCollections({ name: coll }).toArray()).length) {
      console.log(`[dry] would rewrite refs in ${coll} (collection not renamed yet)`);
      continue;
    }
    const docs = await db.collection(coll).find({}).toArray();
    for (const d of docs) {
      const update: Record<string, unknown> = {};
      if (Array.isArray(d.parents)) {
        const parents = d.parents.map(ref);
        if (JSON.stringify(parents) !== JSON.stringify(d.parents)) update.parents = parents;
      }
      if (Array.isArray(d.relations)) {
        const relations = d.relations.map((rel: { kind: string; ref: string }) => ({
          ...rel,
          ref: ref(rel.ref),
        }));
        if (JSON.stringify(relations) !== JSON.stringify(d.relations)) update.relations = relations;
      }
      if (Object.keys(update).length > 0) {
        console.log(`${DRY ? "[dry] " : ""}rewrite refs on ${coll}/${d.slug}`);
        if (!DRY) await db.collection(coll).updateOne({ _id: d._id }, { $set: update });
      }
    }
  }

  // Legacy suggestion keys on stored seeds.
  const seedsName = DRY && !(await db.listCollections({ name: "seeds" }).toArray()).length ? "captures" : "seeds";
  const seedFilter = {
    $or: [
      { "suggested.moleculeSlug": { $exists: true } },
      { "suggested.atomSlug": { $exists: true } },
    ],
  };
  const n = await db.collection(seedsName).countDocuments(seedFilter);
  console.log(`${DRY ? "[dry] " : ""}rename suggestion keys on ${n} ${seedsName}`);
  if (!DRY && n > 0) {
    await db.collection("seeds").updateMany(seedFilter, {
      $rename: {
        "suggested.moleculeSlug": "suggested.podSlug",
        "suggested.atomSlug": "suggested.beanSlug",
      },
    });
  }
  await closeDb();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
