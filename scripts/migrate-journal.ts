// Slice one of the journal model (spec 2026-10-10-journal-model §4 step 2):
// fold every `type:"article"` sprout into its bean's `content` and delete the
// sprout. Every rule lives in lib/journal-migration.ts, with its own tests.
// Usage: npm run migrate:journal            (dry run — the default)
//        npm run migrate:journal -- --apply (writes, and DELETES sprouts)
// Operator sequence: run it bare, read the plan, re-run with `-- --apply`,
// then bare again expecting "0 fold(s)".
//
// The script refuses to write while ANY fold is refused, because a half-folded
// garden — some beans carrying content, some articles still sprouts — renders
// two ways at once. No revalidateGarden(): a CLI has no request store (the
// garden-plant rule), and the next admin write invalidates.
//
// Re-runs: after a clean run the next run plans 0 folds and writes nothing. A
// crash BETWEEN a bean's update and its sprout's delete leaves that bean with
// content and its sprout still present, which the next run REFUSES ("already
// carries a content field — … interrupted fold"); the operator finishes it by
// deleting that sprout by slug, and re-runs for the rest.
//
// Backup: the dry run deliberately writes none — its listing already names
// every slug, and a read-only mode must leave the tree as it found it. The
// live run writes the pre-image of every sprout it deletes to data/retired/,
// refusing if the file exists (a second file would be a second run, and the
// first one's pre-image must not be clobbered). It is NOT committed
// (.gitignore): mongodump is the pre-image of record, and this repo is public.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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
  // article read is in the plan. Only sprouts are backed up: the update filter
  // below IS the bean pre-image — `content` and `relations` both absent, by
  // construction — so there is nothing of the bean's to restore.
  if (existsSync(BACKUP)) throw new Error(`${BACKUP} exists — move it aside before re-running`);
  mkdirSync(BACKUP_DIR, { recursive: true });
  writeFileSync(BACKUP, JSON.stringify({ sprouts: articles }, null, 2) + "\n", "utf8");
  console.log(`backup written: ${BACKUP}`);

  for (const f of plan.folds) {
    // The filter re-checks the plan's rule at write time, so a bean given
    // content or relations between the read and this write is not overwritten.
    const r = await beansCol.updateOne(
      { slug: f.beanSlug, content: { $exists: false }, relations: { $exists: false } },
      { $set: { content: f.content, ...(f.relations ? { relations: f.relations } : {}) } },
    );
    if (r.matchedCount !== 1) {
      throw new Error(`bean ${f.beanSlug} changed under us — stopping before the delete`);
    }
    const d = await sproutsCol.deleteOne({ slug: f.sproutSlug, type: ARTICLE_TYPE });
    if (d.deletedCount !== 1) {
      console.warn(`WARN sprout ${f.sproutSlug}: deletedCount=${d.deletedCount} — the bean is folded, delete it by hand`);
    }
    console.log(`folded ${f.sproutSlug}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
