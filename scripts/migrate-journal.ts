// The journal-model migration (spec 2026-10-10-journal-model §4), in two
// phases over one read of the database. Every rule lives in
// lib/journal-migration.ts, with its own tests; this file applies two plans.
//
//   Phase one — the FOLD (§4 step 2): every `type:"article"` sprout folds into
//   its bean's `content` and is deleted.
//   Phase two — the RE-ANCHOR (§4 steps 1 and 3): every remaining sprout gets
//   `kind` (from its `type`, by KIND_FOR_TYPE) and `about` (from its `bean:`
//   parents), and `type` and `parents` are unset. Its derived plant is checked
//   in the plan, before any write, so no move leaves a sprout dangling.
//
// Usage: npm run migrate:journal            (dry run — the default; it only READS)
//        npm run migrate:journal -- --apply (writes, and DELETES article sprouts)
//
// Operator pre-steps — the plan refuses by name until they are done:
//   - root the `krabs` pod under a plant in the admin (today `parents: []`, so
//     its 25 sprouts roll up to no plant);
//   - delete or retype the `bla` / "Tentative" test sprout in the admin (§4
//     step 4 is an operator act: an unknown type is refused, never guessed at).
// Operator sequence: run it bare, read BOTH plans, re-run with `-- --apply`,
// then bare again expecting "0 fold(s)" AND "0 move(s)" — THEN save any entity
// in the admin (or redeploy). Both phases change PUBLIC data: published article
// sprouts are deleted and content lands on public beans; every public sprout
// moves from `type`/`parents` to `kind`/`about`, which is what the public
// beanstalk and bean pages now read. A CLI cannot invalidate Next's Data Cache
// (no request store — the garden-plant rule, which is why there is no
// revalidateGarden() here), so until something tagged `garden` is written
// through the app, the public site keeps serving the pre-migration dataset.
//
// Ordering: the fold MUST run before the re-anchor on the same database — the
// fold finds its sprouts by `type:"article"`, and the re-anchor unsets `type`.
// Here that is one process, phase one then phase two, and the re-anchor plan is
// computed over the sprouts the fold does NOT delete (an article reaching it is
// a refusal, by name). The script refuses to write while EITHER plan has a
// refusal (exit 2): a half-migrated garden — some sprouts on `kind`, some on
// `type` — renders two ways at once.
//
// Idempotency: after a clean run the next run plans 0 folds and 0 moves and
// writes nothing — a sprout already carrying `kind` and no `type` is skipped.
// A crash BETWEEN a bean's update and its sprout's delete leaves that bean with
// content and its sprout still present, which the next run REFUSES ("already
// carries a content field — … interrupted fold"); the operator finishes it by
// deleting that sprout by slug, and re-runs for the rest. A crash BETWEEN two
// moves is safe: every move is independent and its filter re-checks the plan,
// so the first ones stay done and the rest are planned again on the next run.
//
// Backups: the dry run deliberately writes none — its listing already names
// every slug, and a read-only mode must leave the tree as it found it. The live
// run writes a pre-image per phase to data/retired/ before that phase's first
// write — the whole sprout for every fold (it is deleted), and exactly the two
// fields unset (`type`, `parents`, by slug) for every move — refusing if the
// file exists (a second file would be a second run, and the first one's
// pre-image must not be clobbered). Neither is committed (.gitignore):
// mongodump is the pre-image of record, and this repo is public.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDb, closeDb } from "../lib/db";
import { ARTICLE_TYPE, planArticleFold, planReanchor, type LegacySprout } from "../lib/journal-migration";
import type { Bean, Plant, Pod } from "../lib/data";

const KNOWN = new Set(["--apply", "--dry-run"]);
const UNKNOWN = process.argv.slice(2).filter((a) => !KNOWN.has(a));
// Dry by default: the destructive steps here are a delete and a field unset
// against live data, so they must be typed for deliberately. `--dry-run` stays
// accepted as an explicit no-op, because npm swallows it without the `--`
// separator and an operator who types it must never get a live run by accident.
const DRY = !process.argv.includes("--apply");
const p = () => (DRY ? "[dry] " : "");
const BACKUP_DIR = join(process.cwd(), "data", "retired");
const FOLD_BACKUP = join(BACKUP_DIR, "2026-10-10-article-sprouts.json");
const REANCHOR_BACKUP = join(BACKUP_DIR, "2026-10-10-journal-reanchor.json");

function writeBackup(path: string, body: unknown): void {
  if (existsSync(path)) throw new Error(`${path} exists — move it aside before re-running`);
  mkdirSync(BACKUP_DIR, { recursive: true });
  writeFileSync(path, JSON.stringify(body, null, 2) + "\n", "utf8");
  console.log(`backup written: ${path}`);
}

async function main() {
  if (UNKNOWN.length > 0) {
    throw new Error(`unrecognised argument(s): ${UNKNOWN.join(" ")} — refusing to run`);
  }

  const db = await getDb();
  // Identity banner first: getDb() falls back to the "beanstalk" database when
  // MONGODB_DB is unset, and .env.local is the only thing choosing the cluster.
  console.log(
    `${DRY ? "DRY RUN" : "*** LIVE RUN — WILL DELETE AND REWRITE SPROUTS ***"}  db=${db.databaseName}  host=${new URL(process.env.MONGODB_URI!).host}`,
  );

  const plantsCol = db.collection<Plant>("plants");
  const podsCol = db.collection<Pod>("pods");
  const beansCol = db.collection<Bean>("beans");
  // LegacySprout, not Sprout: the collection holds documents in both shapes
  // until this script has run, and the plan is what tells them apart.
  const sproutsCol = db.collection<LegacySprout>("sprouts");

  // ---- All reads BEFORE any write, so a trip leaves the database as it was.
  const noId = { projection: { _id: 0 } } as const;
  const plants = await plantsCol.find({}, noId).toArray();
  const pods = await podsCol.find({}, noId).toArray();
  const beans = await beansCol.find({}, noId).toArray();
  const sprouts = await sproutsCol.find({}, noId).toArray();

  // ---- Phase one: the fold.
  const articles = sprouts.filter((s) => s.type === ARTICLE_TYPE);
  const fold = planArticleFold(beans, articles);
  for (const f of fold.folds) console.log(`${p()}fold  ${f.sproutSlug} -> bean ${f.beanSlug}`);
  for (const r of fold.refusals) console.log(`REFUSED ${r}`);
  console.log(`${fold.folds.length} fold(s), ${fold.refusals.length} refusal(s), ${articles.length} article sprout(s) read`);

  // ---- Phase two: the re-anchor, over what the fold leaves standing.
  const foldedSlugs = new Set(fold.folds.map((f) => f.sproutSlug));
  const remaining = sprouts.filter((s) => !foldedSlugs.has(s.slug));
  const reanchor = planReanchor(remaining, { plants, pods, beans });
  for (const m of reanchor.moves) console.log(`${p()}move  ${m.slug}  ${m.type} -> ${m.kind}  about ${m.about.join(", ")}`);
  for (const r of reanchor.refusals) console.log(`REFUSED ${r}`);
  console.log(`${reanchor.moves.length} move(s), ${reanchor.refusals.length} refusal(s), ${remaining.length} sprout(s) read`);

  if (fold.refusals.length > 0 || reanchor.refusals.length > 0) {
    console.log("refusing to write while any fold or move is refused");
    process.exitCode = 2;
    return;
  }
  if (DRY) return;

  // ---- Apply phase one.
  if (fold.folds.length > 0) {
    // Pre-image of every sprout about to be deleted, written before the first
    // write. `articles` IS the set being folded: with zero refusals, every
    // article read is in the plan. Only sprouts are backed up: the update
    // filter below IS the bean pre-image — `content` and `relations` both
    // absent, by construction — so there is nothing of the bean's to restore.
    writeBackup(FOLD_BACKUP, { sprouts: articles });
    for (const f of fold.folds) {
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

  // ---- Apply phase two.
  if (reanchor.moves.length > 0) {
    // The pre-image of exactly the fields each move unsets, from the documents
    // as read — `about` and `kind` are SET, not replaced, so there is nothing
    // else to restore.
    const bySlug = new Map(remaining.map((s) => [s.slug, s]));
    writeBackup(
      REANCHOR_BACKUP,
      {
        sprouts: reanchor.moves.map((m) => {
          const s = bySlug.get(m.slug)!;
          return { slug: s.slug, type: s.type, parents: s.parents };
        }),
      },
    );
    for (const m of reanchor.moves) {
      // The filter re-checks the plan at write time: still the type it was
      // planned from, and not yet carrying a kind — so a sprout retyped or
      // re-anchored between the read and this write is left alone, loudly.
      const r = await sproutsCol.updateOne(
        { slug: m.slug, type: m.type, kind: { $exists: false } },
        { $set: { kind: m.kind, about: m.about }, $unset: { type: "", parents: "" } },
      );
      if (r.matchedCount !== 1) throw new Error(`sprout ${m.slug} changed under us — stopping`);
      console.log(`moved ${m.slug}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
