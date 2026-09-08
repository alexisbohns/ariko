/**
 * One-off: the Paulopus capture run — a hundred and seventy screenshots — into
 * Cloudinary and into the `screens` collection.
 *
 * The run happened for the phone-covers slice, which needed eight covers and
 * produced a hundred and seventy images. Seven of the eight came straight out
 * of it; the rest sat in a session scratchpad under /private/tmp, on a path
 * keyed to a conversation id, one cleanup away from not existing. This script
 * is what moves them somewhere durable.
 *
 * WHY THIS ONE SKIPS WHERE scripts/import-casa-media.ts RE-UPLOADS
 *
 * The CASA script re-uploads on every run and says so in its own header:
 * lib/storage.ts deliberately refuses to derive a public_id from a filename
 * (deriving one silently overwrote assets a published sprout pointed at), so
 * Cloudinary mints a fresh id each time and the PREVIOUS run's assets are
 * orphaned rather than replaced. At twelve images that was an acceptable trade
 * with a note to tidy the console afterwards.
 *
 * A hundred and seventy is not. So this script SKIPS ANY SLUG ALREADY IN THE
 * COLLECTION, and three things follow — which together are the whole reason for
 * the difference. It is resumable: if it dies at image 140 the next run picks
 * up at 141 rather than re-uploading the first 140. A careless second run costs
 * nothing instead of 170 uploads and 170 orphans. And no orphaned asset is ever
 * created by re-running at all, so there is no console to tidy.
 *
 * The cost of that choice, stated rather than discovered: this script is NOT
 * idempotent in CASA's sense. CASA rewrites media[] wholesale, so a second run
 * converges on the same result. This one leaves an existing screen exactly as
 * it is — including a name or legend the author has since sharpened by hand,
 * which is the point rather than a limitation. Replacing a screen's image
 * becomes a deliberate act through the admin, never a side effect of running an
 * import twice.
 *
 * Uploads go through lib/storage.ts, server-side. Nothing here talks to
 * Cloudinary from a browser, and nothing here mints a public_id.
 *
 * WHAT HAPPENS IF YOU DELETE THE SKIP — read before you do
 *
 * No test will stop you. `npm test` globs lib/, components/ and
 * scripts/lab-note/, so nothing under scripts/ is exercised at all; removing the
 * `existing.has(slug)` pre-check below leaves `tsc` clean and the suite green.
 * That was verified deliberately rather than assumed, and a test was NOT added,
 * because covering it means widening the glob for one I/O-bound path that talks
 * to both Mongo and Cloudinary.
 *
 * What survives the deletion is the RECORD. `createScreen` inserts against a
 * unique slug index (lib/botanical.ts's ensureBotanicalIndexes), so a second
 * document cannot appear: the insert raises SlugExistsError, the catch below
 * counts it as skipped, and the collection is exactly as correct as before. The
 * record is defended twice.
 *
 * What does NOT survive is the ASSET. The upload happens one line BEFORE the
 * insert, so every already-imported screen is re-uploaded and then discarded —
 * a hundred and seventy pointless uploads and a hundred and seventy orphaned
 * Cloudinary assets on every rerun, silent, and each one a manual delete in a
 * console. The asset is defended once, and the pre-check is that defence.
 *
 * So the blast radius of losing it is waste rather than corruption, which is
 * precisely why it is easy to remove and hard to notice. If you need to replace
 * a screen's image, do it through the admin.
 *
 *   npm run import:screens [source-directory]
 */
import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";
import { getDb } from "../lib/db";
import { uploadImage } from "../lib/storage";
import { createScreen, ensureBotanicalIndexes, SlugExistsError } from "../lib/botanical";
import { screenNameFromStem } from "../lib/screen-name";
import type { Screen } from "../lib/data";

const PLANT_SLUG = "paulopus";

// Overridable by argv so the same script can run against a re-capture in
// another folder; the default is where the run actually landed.
const DEFAULT_SOURCE = join(homedir(), "Pictures", "ariko-screens", "paulopus");

/**
 * The eight screens the landing row is ALREADY using as bean cover art, mapped
 * to the bean each one covers.
 *
 * They get `{ kind: "cover", ref: "bean:<slug>" }` so the library knows which
 * of its images are in service. Until covers become screen references (a later
 * slice), the same Cloudinary asset exists twice — once inline on the bean,
 * once as a screen. That duplication is ACCEPTED, not overlooked, and this
 * relation is precisely what keeps the two knowable from each other in the
 * meantime.
 */
const COVER_OF: Record<string, string> = {
  "home-upcoming-mock": "prediction-timelines",
  "match-debrief-final": "match-anatomy",
  "karma-top": "karma-accountability",
  "match-brief-sources": "live-data-pipeline",
  "match-brief-tactics": "agentic-editorial-pipeline",
  "home-teams": "brand-voice",
  "karma-experience": "prediction-performance",
  "match-tank-no-prediction": "research-process-reflection",
};

/**
 * The source is a capture run's OUTPUT, not a curated folder. Alongside the
 * screens it holds a `library-index.html` contact-sheet viewer and eleven
 * `library-sheet-*.png` sheets — thumbnail grids that are ABOUT the library
 * rather than in it.
 *
 * So the filter is two deliberate halves rather than one heuristic. The
 * extension test is a positive allowlist, which excludes the index page and
 * anything else the directory grows (a .DS_Store, a README, a video). The
 * prefix test is a NAMED exclusion, and it is the half that carries the risk:
 * the contact sheets ARE PNGs of the right size in the right folder, and
 * without this line the run would import eleven pictures-of-pictures as screens
 * and give them slugs (`library-sheet-3`) indistinguishable from real ones.
 *
 * Both halves are conservative in the same direction: a file this predicate is
 * unsure about is not imported, and a screen that fails to arrive is a rerun
 * away. A contact sheet that arrives is a manual delete in two systems.
 */
const SHEET_PREFIX = "library-sheet";

function isScreenFile(filename: string): boolean {
  return /\.png$/i.test(filename) && !filename.startsWith(SHEET_PREFIX);
}

// Numeric-aware, borrowed from the CASA script for its reason: "shot-10.png"
// sorts after 9 rather than after 1. Nothing here depends on order — each
// screen is its own document — but a stable, human order makes the console log
// readable and a resumed run's progress obvious.
const byName = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

async function main() {
  const source = process.argv[2] ?? DEFAULT_SOURCE;
  // One date for the whole run, not a per-file mtime: this WAS one capture run,
  // and a hundred and seventy timestamps that differ by minutes would suggest a
  // precision the field does not have.
  const capturedAt = new Date().toISOString().slice(0, 10);

  // createScreen's collision path is only real while the unique slug index
  // exists; this is idempotent and costs one round trip.
  await ensureBotanicalIndexes();

  const db = await getDb();
  // Fetched ONCE rather than a findOne per file. A concurrent writer could slip
  // a slug in behind this snapshot, which is why the loop still catches
  // SlugExistsError — but in a one-off script run by one person, the round trips
  // are the real cost and the race is not.
  const existing = new Set(
    (
      await db
        .collection<Screen>("screens")
        .find({}, { projection: { _id: 0, slug: 1 } })
        .toArray()
    ).map((s) => s.slug),
  );

  const files = readdirSync(source).filter(isScreenFile).sort(byName);
  console.log(`${files.length} screens in ${source}; ${existing.size} already stored\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const covered = new Set<string>();

  for (const file of files) {
    const slug = basename(file, extname(file));
    const beanSlug = COVER_OF[slug];
    if (beanSlug) covered.add(slug);

    // The skip. No test guards this line — see the header for what it protects
    // (the Cloudinary asset) and what protects the record without it (the
    // unique slug index, one line down in the catch).
    if (existing.has(slug)) {
      skipped++;
      continue;
    }

    try {
      const image = await uploadImage(readFileSync(join(source, file)), file);
      await createScreen({
        slug,
        name: screenNameFromStem(slug),
        image,
        plantSlug: PLANT_SLUG,
        ...(beanSlug ? { relations: [{ kind: "cover", ref: `bean:${beanSlug}` }] } : {}),
        capturedAt,
      });
      created++;
      console.log(`  + ${slug}${beanSlug ? `  (cover of bean:${beanSlug})` : ""}`);
    } catch (err) {
      if (err instanceof SlugExistsError) {
        // Lost the race described above. The asset uploaded a line earlier IS
        // orphaned — the one case this script can still orphan, and it needs a
        // second writer to happen at all.
        skipped++;
        continue;
      }
      // One unreadable file, one Cloudinary hiccup, must not cost the other
      // hundred and sixty-nine their run. The slug is simply not in the
      // collection, so the next run retries exactly this file and no other.
      failed++;
      console.error(`  ! ${slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // A cover mapping that matches no file is a SILENT failure otherwise: the
  // eight relations are the one thing here that cannot be re-derived from the
  // directory, so a renamed capture would quietly ship a library that has
  // forgotten which images the landing row is using.
  const unmatched = Object.keys(COVER_OF).filter((s) => !covered.has(s));
  if (unmatched.length > 0) {
    console.warn(`\n  ? cover mappings matching no file: ${unmatched.join(", ")}`);
  }

  console.log(`\ncreated ${created} · skipped ${skipped} · failed ${failed}`);
  // Non-zero on any failure, so a run that half-worked cannot read as a success
  // in a scrollback. The failures are already reported by name above.
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
