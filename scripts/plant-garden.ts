import { readFileSync } from "node:fs";
import { parseManifest } from "../lib/garden-manifest";
import { planGarden, renderPlan } from "../lib/garden-plan";
import { applyPlan } from "../lib/plant-garden-apply";
import { loadRawGarden } from "../lib/store";

/**
 * Plants a sibling repo's `garden.yml` into this garden.
 *
 *     npm run garden:plant -- <manifest.yml> [--dry-run] [--update]
 *
 * A CLI reading a FILE rather than an HTTP ingest route, because that is what
 * keeps the database credential inside this repo: a sibling project describes
 * itself declaratively, a human here plants it.
 *
 * Thin on purpose — argv, a file read, orchestration and printing. Everything
 * that can be wrong in a way worth testing lives in `lib/garden-manifest.ts`
 * (the author's file), `lib/garden-plan.ts` (this garden) and
 * `lib/plant-garden-apply.ts` (the writes).
 *
 * THE WHOLE FILE IS VALIDATED BEFORE THE DATABASE IS TOUCHED. A manifest that
 * failed halfway would leave a pod that exists with three of its five beans
 * missing, which is a worse state than an untouched garden and one nothing
 * reports: the read path tolerates a missing child by simply not listing it.
 *
 * THE GARDEN CACHE IS DELIBERATELY NOT INVALIDATED, and this is not an
 * oversight. Two reasons, either of which alone would settle it:
 *
 *  - `revalidateGarden()` (`lib/garden-cache.ts`) calls Next's `revalidateTag`
 *    and tolerates exactly one failure — "static generation store missing". A
 *    CLI has no Next request store, so that is precisely the branch it would
 *    take: the call would succeed, print nothing, and invalidate nothing. An
 *    invalidation that LOOKS like one and is not is worse than none at all.
 *  - It is unnecessary anyway. Everything this script writes is private (see
 *    `lib/plant-garden-apply.ts`'s rules), and the cached dataset is built from
 *    `filterPublic`, which drops all of it. The public garden is unchanged by
 *    definition until the author publishes in the admin — and every one of the
 *    four real write doors sits in the admin or an API route, where a store
 *    exists.
 */

interface Args {
  path: string | null;
  dryRun: boolean;
  update: boolean;
}

function parseArgs(argv: string[]): Args {
  let path: string | null = null;
  for (const arg of argv) {
    if (!arg.startsWith("--") && path === null) path = arg;
  }
  return {
    path,
    dryRun: argv.includes("--dry-run"),
    update: argv.includes("--update"),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.path) {
    console.error("usage: npm run garden:plant -- <manifest.yml> [--dry-run] [--update]");
    process.exit(1);
  }

  const parsed = parseManifest(readFileSync(args.path, "utf8"));
  if (!parsed.ok) {
    console.error(`manifest invalid: ${parsed.error}`);
    console.error("nothing was written.");
    process.exit(1);
  }

  const garden = await loadRawGarden();
  // `RawGarden`'s tiers are optional; `GardenSlugs` names the three this plan
  // diffs against, so the widening happens here rather than inside the planner.
  const plan = planGarden(
    parsed.manifest,
    { pods: garden.pods ?? [], beans: garden.beans ?? [], sprouts: garden.sprouts ?? [] },
    { update: args.update },
  );

  console.log(renderPlan(plan));
  console.log("");

  if (args.dryRun) {
    console.log("--dry-run: nothing was written.");
    process.exit(0);
  }

  await applyPlan(plan);

  for (const action of plan) {
    if (action.action === "skip") continue;
    console.log(`${action.action} ${action.tier} ${action.slug}`);
  }

  console.log("");
  console.log("Everything written is PRIVATE. Publish it in the Ariko admin.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
