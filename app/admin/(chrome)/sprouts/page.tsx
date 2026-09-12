import { getFullDataset } from "@/lib/store";
import type { TimelineEntry } from "@/lib/data";
import { filterSproutEntries, distinctPlants, distinctTags, SPROUT_KEYS } from "@/lib/sprouts";
import { filterHref } from "@/lib/admin-filters";
import { SPROUT_STATES } from "@/lib/sprout-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AdminFilters, type FilterGroup } from "../../_components/admin-filters";
import { SproutTable } from "../../_components/sprout-table";

export const dynamic = "force-dynamic";

// "all" is not a member of the vocabulary — it is the filter bar's sentinel
// for "no filter" (lib/admin-filters.ts's convention) — so it stays spelled
// here. The three states themselves come from SPROUT_STATES rather than a
// third hand-typed copy, so a state that vocabulary ever grows or renames
// cannot leave this filter bar naming a stage that no longer exists.
const STATE_OPTIONS = ["all", ...SPROUT_STATES];

export default async function AdminSproutsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; plant?: string; tag?: string }>;
}) {
  const active = await searchParams;

  let all: TimelineEntry[] | null = null;
  try {
    all = (await getFullDataset()).timelineSprouts();
  } catch {
    all = null;
  }

  if (all === null) {
    return (
      <article>
        <h1 className="mb-4 font-heading text-2xl font-medium tracking-tight">Sprouts</h1>
        <Alert variant="destructive" role="alert">
          <AlertDescription>Couldn&apos;t load the sprouts.</AlertDescription>
        </Alert>
      </article>
    );
  }

  const entries = filterSproutEntries(all, active);
  const plantOptions = ["all", ...distinctPlants(all)];
  const tagOptions = ["all", ...distinctTags(all)];

  // The hrefs are still built here, now by the shared filterHref, so the
  // popovers stay a presentation of links this page already knew how to make —
  // and stay server-side, which is what keeps `lib/sprouts.ts` out of the island.
  const groups: FilterGroup[] = (
    [
      ["state", STATE_OPTIONS],
      ["plant", plantOptions],
      ["tag", tagOptions],
    ] as const
  ).map(([key, options]) => ({
    key,
    options,
    current: active[key] ?? "all",
    hrefs: options.map((opt) => filterHref("/admin/sprouts", active, SPROUT_KEYS, key, opt)),
  }));

  return (
    <article>

      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-2xl font-medium tracking-tight">Sprouts</h1>

        <AdminFilters groups={groups} />

        <p className="text-sm text-muted-foreground">
          showing {entries.length} of {all.length}
        </p>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching sprouts.</p>
        ) : (
          <SproutTable entries={entries} />
        )}
      </div>
    </article>
  );
}
