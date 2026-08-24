// Plant role backfill. `Plant.role` is REQUIRED, and every plant already in
// Mongo predates it — this gives each of them one so the type stops being a
// promise the database does not keep.
//
// Usage: npm run backfill:plant-roles [-- --dry-run]
//
// Operator sequence, in this order:
//   1. npm run backfill:plant-roles -- --dry-run   (review the count)
//   2. npm run backfill:plant-roles
//   3. npm run validators                          (tightens `role` to required)
//
// The backfill goes FIRST so no write can be rejected mid-flight. (`applyValidator`
// uses validationLevel "moderate", which would not reject the existing docs
// anyway — but the ordering should not depend on that.)
//
// Every plant gets `owner`, deliberately. The four that are not — Oxymore
// (co-owner), Teale and Enerfip (lead, with their real titles) — are corrected
// BY HAND afterwards, through the new role card on /admin/plant/[slug]. That
// makes the form's first real exercise the same act that fixes the data.
//
// Idempotent: the filter is `role` absent, so a re-run touches nothing, and a
// hand-authored role can never be clobbered.
import { getDb, closeDb } from "../lib/db";
import type { Plant } from "../lib/data";

const DRY = process.argv.includes("--dry-run");

async function main() {
  const db = await getDb();
  const plants = db.collection<Plant>("plants");

  const missing = await plants.find({ role: { $exists: false } }, { projection: { _id: 0, slug: 1 } }).toArray();
  console.log(
    `${DRY ? "[dry] " : ""}plants without a role: ${missing.length}` +
      (missing.length > 0 ? ` — ${missing.map((p) => p.slug).join(", ")}` : ""),
  );

  if (missing.length === 0) {
    console.log("nothing to backfill");
    return;
  }
  if (DRY) {
    console.log("[dry] would set role: { kind: 'owner' } on each");
    return;
  }

  const res = await plants.updateMany(
    { role: { $exists: false } },
    { $set: { role: { kind: "owner" } } },
  );
  console.log(`backfilled: ${res.modifiedCount}`);
  console.log("now correct the non-owner plants by hand in /admin/plant/[slug], then: npm run validators");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeDb);
