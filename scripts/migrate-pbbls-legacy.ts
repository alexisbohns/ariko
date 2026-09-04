// One-shot (#54): retires the four seeded pbbls beans, files their twelve
// changelog sprouts under the beans they advance, and seeds the 36 missing
// bean stubs. Catalogs and rules live in lib/pbbls-legacy.ts.
// Usage: npm run migrate:pbbls-legacy            (dry run — the default)
//        npm run migrate:pbbls-legacy -- --apply (writes, and DELETES)
// Operator sequence: run it bare, read the plan and the backup it wrote, then
// re-run with `-- --apply`, then bare again expecting all no-ops, then commit
// the backup file.
//
// Unlike scripts/migrate-retier.ts this NEVER writes data/garden.yml. That
// script ends in yaml.dump, which erases comments; garden.yml's comments are
// load-bearing and one of them is the warning this work adds. The YAML half is
// a hand edit, proven correct by lib/pbbls-legacy.test.ts.
//
// Idempotent: stubs are $setOnInsert, sprout writes are diffed per doc, the
// backup merges rather than replaces, and the delete is a no-op once the beans
// are gone.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDb, closeDb } from "../lib/db";
import { LEGACY_BEANS, MILESTONE_TYPE, SPROUT_MAP, STUB_BEANS } from "../lib/pbbls-legacy";
import type { Bean, Sprout } from "../lib/data";

const KNOWN = new Set(["--apply", "--dry-run"]);
const UNKNOWN = process.argv.slice(2).filter((a) => !KNOWN.has(a));
// Dry by default: the only destructive step here is a delete against live data,
// so it must be typed for deliberately. `--dry-run` stays accepted as an
// explicit no-op, because npm swallows it without the `--` separator and an
// operator who types it must never get a live run by accident.
const DRY = !process.argv.includes("--apply");
const p = () => (DRY ? "[dry] " : "");
const BACKUP_DIR = join(process.cwd(), "data", "retired");
const BACKUP = join(BACKUP_DIR, "2026-09-04-legacy-pbbls-beans.json");

// What the backup file holds: the beans about to be deleted, and the pre-image
// of every sprout whose parents/type this run overwrites in place. Step 2 is a
// destructive $set with no history of its own, so its pre-image belongs here
// next to the deleted rows.
type Backup = { beans: Bean[]; sprouts: Sprout[] };

async function main() {
  if (UNKNOWN.length > 0) {
    throw new Error(`unrecognised argument(s): ${UNKNOWN.join(" ")} — refusing to run`);
  }

  const db = await getDb();
  // Identity banner first: getDb() falls back to the "beanstalk" database when
  // MONGODB_DB is unset, and .env.local is the only thing choosing the cluster.
  // An operator must never have to infer which database is about to lose rows.
  console.log(
    `${DRY ? "DRY RUN" : "*** LIVE RUN — WILL DELETE ***"}  db=${db.databaseName}  host=${new URL(process.env.MONGODB_URI!).host}`,
  );

  const beansCol = db.collection<Bean>("beans");
  const sproutsCol = db.collection<Sprout>("sprouts");
  const legacyRefs = LEGACY_BEANS.map((s) => `bean:${s}`);

  // ---- Pre-flight. All reads, all BEFORE any write, so a trip leaves the
  // database exactly as it was rather than half-migrated.

  // FATAL: pollen would resurrect what we delete. lib/projected-beans.ts
  // materialises a bean for any envelope anchor with no authored bean, and
  // marks it PUBLIC when the anchored plant is exhibited — data/federation.yml
  // exhibits plant:pbbls. So an envelope anchored at a retired slug, or a
  // doomed bean carrying `projected`, means the next pollen sync or
  // `npm run pollen:rebuild` republishes exactly the slugs being retired for
  // slug-shadowing. Both are 0 today; this refuses if that ever changes.
  const anchored = await db.collection("pollen").countDocuments({ "anchors.bean": { $in: legacyRefs } });
  const projected = await beansCol.countDocuments({ slug: { $in: [...LEGACY_BEANS] }, projected: { $exists: true } });
  if (anchored > 0 || projected > 0) {
    throw new Error(
      `pollen would resurrect a retired bean: ${anchored} envelope(s) anchor a legacy bean and ` +
        `${projected} doomed bean(s) carry a \`projected\` field. A projected bean on an exhibited ` +
        `plant is materialised PUBLIC, so the delete would be undone publicly at the very slugs ` +
        `being retired. Nothing was written. Re-anchor those envelopes, or drop their feed, first.`,
    );
  }

  // WARNING, not fatal: a dangling ref renders as nothing (resolveEntity returns
  // null), so it can neither crash nor leak — but a published narrative quietly
  // loses a card, and the operator should hear about it rather than discover it.
  for (const name of ["sprouts", "plants", "pods"] as const) {
    const n = await db.collection(name).countDocuments({ "relations.ref": { $in: legacyRefs } });
    if (n > 0) console.warn(`${p()}WARN ${n} ${name} doc(s) link a legacy bean in relations[] — those cards will render as nothing`);
  }
  const suggested = await db.collection("seeds").countDocuments({ "suggested.beanSlug": { $in: [...LEGACY_BEANS] } });
  if (suggested > 0) console.warn(`${p()}WARN ${suggested} seed(s) suggest a legacy bean — triage will offer a slug that no longer exists`);

  // FATAL: a sprout sitting on a legacy bean that SPROUT_MAP does not name
  // would be orphaned by the delete. Mongo carries admin-authored sprouts the
  // seed does not, so this is a real possibility.
  const unroutable = await sproutsCol
    .find(
      { parents: { $in: legacyRefs }, slug: { $nin: Object.keys(SPROUT_MAP) } },
      { projection: { _id: 0, slug: 1, parents: 1 } },
    )
    .toArray();
  if (unroutable.length > 0) {
    for (const s of unroutable) console.error(`  unroutable: ${s.slug} ${JSON.stringify(s.parents)}`);
    throw new Error(
      `${unroutable.length} sprout(s) sit on a legacy bean that SPROUT_MAP does not name, and would ` +
        `be orphaned by the delete. Nothing was written.\n` +
        `Do NOT add them to SPROUT_MAP: the suite pins it at exactly twelve entries and requires every ` +
        `key to exist in data/garden.yml, and seeding a Mongo-only sprout would let migrate-garden ` +
        `overwrite its authored fields — the trap AUTHORED_BEANS exists to avoid.\n` +
        `The admin cannot re-parent a sprout either (updateVersion never touches parents, and the bean ` +
        `is read-only on the sprout page). Two real options: $set the sprout's parents[] directly in ` +
        `Mongo, or delete it and re-promote it from the inbox onto the right bean. Then re-run.`,
    );
  }

  // What the operator is really authorising: these move from public beans to
  // private stubs, so they leave the public site. Intended, and stated out loud.
  const published = await sproutsCol.countDocuments({ slug: { $in: Object.keys(SPROUT_MAP) }, state: "published" });
  console.log(`${p()}${published} published sprout(s) will leave the public site (public bean -> private stub)`);

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

  // 2) Re-parent and retype the twelve, diffed so a re-run logs nothing. The
  //    pre-image of every doc this rewrites is kept for the backup file: the
  //    $set below is destructive and leaves no history of its own.
  const sproutBackup: Sprout[] = [];
  let moved = 0;
  for (const [slug, bean] of Object.entries(SPROUT_MAP)) {
    const doc = await sproutsCol.findOne({ slug }, { projection: { _id: 0 } });
    if (!doc) {
      console.warn(`${p()}WARN sprout ${slug} not found in Mongo — skipped`);
      continue;
    }
    const parents = [`bean:${bean}`];
    if (doc.type === MILESTONE_TYPE && JSON.stringify(doc.parents) === JSON.stringify(parents)) continue;
    // Log the change, not just the destination: a second parent about to be
    // dropped is then visible rather than silent.
    console.log(`${p()}re-parent sprout ${slug}: ${JSON.stringify(doc.parents)}/${doc.type} -> ${JSON.stringify(parents)}/${MILESTONE_TYPE}`);
    sproutBackup.push(doc);
    moved++;
    if (!DRY) await sproutsCol.updateOne({ slug }, { $set: { parents, type: MILESTONE_TYPE } });
  }

  // 3) Back up, then delete. LAST, when nothing points at them any more.
  // Postcondition: after the moves, nothing may point at a legacy bean. Skipped
  // on a dry run, where nothing was written and the twelve are still on their
  // old beans by definition -- which is exactly what made the old single guard
  // abort every dry run before it could show the delete.
  if (!DRY) {
    const stillHeld = await sproutsCol.countDocuments({ parents: { $in: legacyRefs } });
    if (stillHeld > 0) {
      throw new Error(`${stillHeld} sprout(s) still parented to a legacy bean after the move — aborting before the delete.`);
    }
  }

  // _id is kept for the delete so "what was backed up is what was deleted" is
  // true by construction, and stripped for the file. Restoring from the backup
  // mints new ObjectIds, which is harmless: everything refs by slug.
  const doomedDocs = await beansCol.find({ slug: { $in: [...LEGACY_BEANS] } }).toArray();
  const doomed: Bean[] = doomedDocs.map(({ _id, ...rest }) => rest);
  if (doomed.length > 0 && doomed.length !== LEGACY_BEANS.length) {
    console.warn(
      `${p()}WARN found ${doomed.length} of ${LEGACY_BEANS.length} legacy beans — an earlier run was ` +
        `probably interrupted mid-delete. The backup MERGES, so the rows already deleted keep theirs.`,
    );
  }

  if (doomed.length === 0 && sproutBackup.length === 0) {
    console.log(`${p()}no legacy bean left to delete`);
  } else {
    // Written even on a dry run: it is a read of the DB, and the operator must
    // be able to read the backup BEFORE authorising the delete.
    //
    // MERGED, never replaced. `doomed.length === 0` alone would stop an empty
    // clobber but not a partial one: a run that died mid-deleteMany leaves two
    // beans, and a naive re-run would overwrite a complete four-bean backup
    // with two, destroying the reversal path for the other two before Task 4
    // ever commits the file.
    const prior: Backup = existsSync(BACKUP)
      ? (JSON.parse(readFileSync(BACKUP, "utf8")) as Backup)
      : { beans: [], sprouts: [] };
    const merged: Backup = {
      beans: [...(prior.beans ?? []).filter((b) => !doomed.some((d) => d.slug === b.slug)), ...doomed],
      sprouts: [...(prior.sprouts ?? []).filter((s) => !sproutBackup.some((d) => d.slug === s.slug)), ...sproutBackup],
    };
    if (merged.beans.length < (prior.beans ?? []).length || merged.sprouts.length < (prior.sprouts ?? []).length) {
      throw new Error("backup would shrink — refusing to overwrite");
    }
    mkdirSync(BACKUP_DIR, { recursive: true });
    writeFileSync(BACKUP, JSON.stringify(merged, null, 2) + "\n", "utf8");
    console.log(`${p()}backed up ${merged.beans.length} bean(s) + ${merged.sprouts.length} sprout pre-image(s) to ${BACKUP}`);
    for (const b of doomed) console.log(`${p()}delete bean ${b.slug}`);
    if (!DRY && doomedDocs.length > 0) {
      await beansCol.deleteMany({ _id: { $in: doomedDocs.map((d) => d._id) } });
    }
  }

  console.log(
    DRY
      ? `[dry] done — ${inserted} stub(s) would be inserted, ${moved} sprout(s) would be refiled, ${doomed.length} bean(s) would be retired. Re-run with \`-- --apply\` to write.`
      : `done — ${inserted} stub(s) inserted, ${moved} sprout(s) refiled, ${doomed.length} bean(s) retired.`,
  );
  await closeDb();
}

// No `finally { closeDb() }`: the catch exits the process, which drops the
// connection anyway, and a close racing a thrown error would only obscure it.
// Success ends the process naturally — process.exit() here would truncate
// piped output, and an operator will want `| tee`.
main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
