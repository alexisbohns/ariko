import { closeDb } from "../lib/db";
import { getFederation } from "../lib/federation";
import { runSync } from "../lib/pollen-run";
import { deleteFeedData } from "../lib/pollen-store";

// Full rebuild of one feed's slice of the cache (spec §3): wipe, then sync.
// A dev script, not an admin button — destructive paths stay deliberate.
async function main() {
  const feedId = process.argv[2];
  const { feeds } = getFederation();
  if (!feedId || !feeds.some((f) => f.id === feedId)) {
    console.error(`usage: npm run pollen:rebuild -- <feedId>  (one of: ${feeds.map((f) => f.id).join(", ")})`);
    process.exit(1);
  }
  console.log(`wiping feed ${feedId}…`);
  await deleteFeedData(feedId);
  const results = await runSync(feedId);
  console.log(JSON.stringify(results, null, 2));
  await closeDb();
  if (results.some((r) => r.status === "error")) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
