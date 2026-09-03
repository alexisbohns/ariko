// One-shot (#54): retires the four seeded pbbls beans, files their twelve
// changelog sprouts under the beans they advance, and seeds the 36 missing
// bean stubs. Catalogs and rules live in lib/pbbls-legacy.ts.
// Usage: npm run migrate:pbbls-legacy [-- --dry-run]
// Operator sequence: dry-run, read the plan, run for real, dry-run again
// expecting all no-ops, then commit the backup file it wrote.
//
// Unlike scripts/migrate-retier.ts this NEVER writes data/garden.yml. That
// script ends in yaml.dump, which erases comments; garden.yml's comments are
// load-bearing and one of them is the warning this work adds. The YAML half is
// a hand edit, proven correct by lib/pbbls-legacy.test.ts.
//
// Idempotent: stubs are $setOnInsert, sprout writes are diffed per doc, and the
// delete is a no-op once the beans are gone.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDb, closeDb } from "../lib/db";
import { LEGACY_BEANS, MILESTONE_TYPE, SPROUT_MAP, STUB_BEANS } from "../lib/pbbls-legacy";
import type { Bean, Sprout } from "../lib/data";

const DRY = process.argv.includes("--dry-run");
const p = () => (DRY ? "[dry] " : "");
const BACKUP_DIR = join(process.cwd(), "data", "retired");
const BACKUP = join(BACKUP_DIR, "2026-09-04-legacy-pbbls-beans.json");

async function main() {
  const db = await getDb();
  const beansCol = db.collection<Bean>("beans");
  const sproutsCol = db.collection<Sprout>("sprouts");

  // 1) Stubs FIRST — step 2 re-parents sprouts onto them, so they must exist
  //    before anything points at them.
  let inserted = 0;
  for (const stub of STUB_BEANS) {
    const existing = await beansCol.findOne({ slug: stub.slug }, { projection: { _id: 0, slug: 1 } });
    if (existing) {
      console.log(`${p()}bean ${stub.slug} already present — untouched`);
      continue;
    }
    console.log(`${p()}insert stub bean ${stub.slug}`);
    inserted++;
    // $setOnInsert, belt to lib/pbbls-legacy.ts's braces: even if the guard
    // above were wrong, an existing authored bean could not be overwritten.
    if (!DRY) {
      await beansCol.updateOne({ slug: stub.slug }, { $setOnInsert: { ...stub } }, { upsert: true });
    }
  }

  // 2) Re-parent and retype the twelve, diffed so a re-run logs nothing.
  let moved = 0;
  for (const [slug, bean] of Object.entries(SPROUT_MAP)) {
    const doc = await sproutsCol.findOne({ slug }, { projection: { _id: 0, parents: 1, type: 1 } });
    if (!doc) {
      console.warn(`${p()}WARN sprout ${slug} not found in Mongo — skipped`);
      continue;
    }
    const parents = [`bean:${bean}`];
    if (doc.type === MILESTONE_TYPE && JSON.stringify(doc.parents) === JSON.stringify(parents)) continue;
    console.log(`${p()}re-parent sprout ${slug} -> bean:${bean}, type ${MILESTONE_TYPE}`);
    moved++;
    if (!DRY) await sproutsCol.updateOne({ slug }, { $set: { parents, type: MILESTONE_TYPE } });
  }

  // 3) Back up, then delete. LAST, when nothing points at them any more.
  const legacyRefs = LEGACY_BEANS.map((s) => `bean:${s}`);
  const stillHeld = await sproutsCol.countDocuments({ parents: { $in: legacyRefs } });
  if (stillHeld > 0) {
    throw new Error(
      `${stillHeld} sprout(s) still parented to a legacy bean — aborting before the delete. ` +
        `Re-run without --dry-run to move them first, or extend SPROUT_MAP.`,
    );
  }

  const doomed = await beansCol.find({ slug: { $in: [...LEGACY_BEANS] } }, { projection: { _id: 0 } }).toArray();
  if (doomed.length === 0) {
    console.log(`${p()}no legacy bean left to delete`);
  } else {
    // Written even on a dry run: it is a read of the DB, and the operator
    // should be able to read the backup BEFORE authorising the delete. Guarded
    // by the length check above so a re-run cannot clobber it with [].
    mkdirSync(BACKUP_DIR, { recursive: true });
    writeFileSync(BACKUP, JSON.stringify(doomed, null, 2) + "\n", "utf8");
    console.log(`${p()}backed up ${doomed.length} bean(s) to ${BACKUP}`);
    for (const b of doomed) console.log(`${p()}delete bean ${b.slug}`);
    if (!DRY) await beansCol.deleteMany({ slug: { $in: [...LEGACY_BEANS] } });
  }

  console.log(
    `${p()}done — ${inserted} stub(s) inserted, ${moved} sprout(s) refiled, ${doomed.length} bean(s) retired.`,
  );
  await closeDb();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
