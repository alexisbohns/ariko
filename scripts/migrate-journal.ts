// Slice one of the journal model (spec 2026-10-10-journal-model §4 step 2):
// fold every `type:"article"` sprout into its bean's `content` and delete the
// sprout. Every rule lives in lib/journal-migration.ts, with its own tests.
// Usage: npm run migrate:journal            (dry run — the default)
//        npm run migrate:journal -- --apply (writes, and DELETES sprouts)
// Operator sequence: run it bare, read the plan, re-run with `-- --apply`,
// then bare again expecting "0 fold(s)". The backup under data/retired/ is
// NOT committed: it is a pre-image to restore from, not history to keep.
//
// The script refuses to write while ANY fold is refused, because a half-folded
// garden — some beans carrying content, some articles still sprouts — renders
// two ways at once. No revalidateGarden(): a CLI has no request store (the
// garden-plant rule), and the next admin write invalidates.
//
// Idempotent: a folded article is gone, so a re-run plans 0 folds and writes
// nothing — not even the backup.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDb, closeDb } from "../lib/db";
import { ARTICLE_TYPE, planArticleFold } from "../lib/journal-migration";
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
const BACKUP = join(BACKUP_DIR, "2026-10-10-article-sprouts.json");

async function main() {
  if (UNKNOWN.length > 0) {
    throw new Error(`unrecognised argument(s): ${UNKNOWN.join(" ")} — refusing to run`);
  }

  const db = await getDb();
  // Identity banner first: getDb() falls back to the "beanstalk" database when
  // MONGODB_DB is unset, and .env.local is the only thing choosing the cluster.
  console.log(
    `${DRY ? "DRY RUN" : "*** LIVE RUN — WILL DELETE SPROUTS ***"}  db=${db.databaseName}  host=${new URL(process.env.MONGODB_URI!).host}`,
  );

  const beansCol = db.collection<Bean>("beans");
  const sproutsCol = db.collection<Sprout>("sprouts");

  // ---- All reads BEFORE any write, so a trip leaves the database as it was.
  const beans = await beansCol.find({}, { projection: { _id: 0 } }).toArray();
  const articles = await sproutsCol.find({ type: ARTICLE_TYPE }, { projection: { _id: 0 } }).toArray();
  const plan = planArticleFold(beans, articles);

  for (const f of plan.folds) console.log(`${p()}fold  ${f.sproutSlug} -> bean ${f.beanSlug}`);
  for (const r of plan.refusals) console.log(`REFUSED ${r}`);
  console.log(`${plan.folds.length} fold(s), ${plan.refusals.length} refusal(s), ${articles.length} article sprout(s) read`);

  if (plan.refusals.length > 0) {
    console.log("refusing to write while any fold is refused");
    process.exitCode = 2;
    return;
  }
  if (DRY || plan.folds.length === 0) return;

  // Pre-image of every sprout about to be deleted, written before the first
  // write. `articles` IS the set being folded: with zero refusals, every
  // article read is in the plan.
  mkdirSync(BACKUP_DIR, { recursive: true });
  writeFileSync(BACKUP, JSON.stringify({ sprouts: articles }, null, 2) + "\n", "utf8");
  console.log(`backup written: ${BACKUP}`);

  for (const f of plan.folds) {
    // `content: { $exists: false }` re-checks the plan's rule at write time, so
    // a bean given content between the read and this write is not overwritten.
    const r = await beansCol.updateOne(
      { slug: f.beanSlug, content: { $exists: false } },
      { $set: { content: f.content, ...(f.relations ? { relations: f.relations } : {}) } },
    );
    if (r.matchedCount !== 1) {
      throw new Error(`bean ${f.beanSlug} changed under us — stopping before the delete`);
    }
    await sproutsCol.deleteOne({ slug: f.sproutSlug, type: ARTICLE_TYPE });
    console.log(`folded ${f.sproutSlug}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
