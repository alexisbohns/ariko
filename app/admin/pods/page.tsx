import type { EntityMark } from "@/components/admin/glyphs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { filterHref } from "@/lib/admin-filters";
import { resolveScope, scopeKeysFor } from "@/lib/admin-scope";
import { PLANT_PREFIX, buildDataset, parentsWithPrefix, resolveText, textPart } from "@/lib/data";
import { loadRawGarden } from "@/lib/store";
import { AdminFilters, type FilterGroup } from "../_components/admin-filters";
import { PodTable, type PodRow } from "../_components/pod-table";

export const dynamic = "force-dynamic";

const PATH = "/admin/pods";

// The accessor, not a bare index: `tsconfig.json` has `strict` without
// `noUncheckedIndexedAccess`, so a bare `scopeKeys[PATH]` is typed as always
// present and a renamed path would reach `filterQuery` as undefined — "keys is
// not iterable" at runtime, clean through `tsc`, `npm test` and `npm run build`.
const KEYS = scopeKeysFor(PATH) ?? [];

/**
 * A row plus the slug it narrows by.
 *
 * `PodRow.plant` is a MARK — a name and an optional logo, resolved so the
 * table can draw it — and a pod whose plant ref resolves to nothing has no
 * mark at all. So the mark cannot be what the filter compares; the raw ref
 * rides alongside it for that.
 */
interface Row extends PodRow {
  plantSlug?: string;
}

/**
 * The pod index, narrowed by plant.
 *
 * Pods were half of `/admin/garden`, in a table that had to carry a tier
 * column before it could say anything — one section per tier means these
 * columns are the pod's own: its beans, its visibility, whether it holds
 * narrative.
 *
 * `PodTable` draws the rows and the hub's preview renders the same component,
 * so the two cannot drift; `limit` and `showPlant` are what differ. Here the
 * plant column stays, because the index spans every plant and a pod row that
 * does not name its plant says almost nothing.
 *
 * Narrowing compares the plant REF in `parents`, not the resolved mark. An
 * unrooted pod, and one naming a plant the garden no longer holds, are the
 * same case to the table — both draw the em dash rather than a wrong name —
 * but they are not the same case to the filter: `?plant=` on a slug nothing
 * resolves narrows to the pods that still name it, which is how you find them.
 * The scope itself comes from `resolveScope`, the one reader of `?plant=`, so
 * this page and the chrome above it cannot disagree about what it says.
 */
export default async function AdminPodsPage({
  searchParams,
}: {
  searchParams: Promise<{ plant?: string }>;
}) {
  const active = await searchParams;

  let all: Row[] | null = null;
  try {
    const dataset = buildDataset(await loadRawGarden());
    const marks = new Map<string, EntityMark>(
      dataset.getPlants().map((plant) => [
        plant.slug,
        {
          name: resolveText(plant.name),
          hint: plant.slug,
          ...(plant.logo ? { logoUrl: plant.logo.url } : {}),
        },
      ]),
    );
    all = dataset
      .getPods()
      .map((pod) => {
        const plantSlug = parentsWithPrefix(pod.parents, PLANT_PREFIX)[0];
        const plant = plantSlug ? marks.get(plantSlug) : undefined;
        return {
          slug: pod.slug,
          name: resolveText(pod.name),
          visibility: pod.visibility ?? "public",
          hasNarrative: textPart(pod.content, "en").trim().length > 0,
          beanCount: dataset.beansForPod(pod.slug).length,
          ...(plantSlug ? { plantSlug } : {}),
          ...(plant ? { plant } : {}),
        };
      })
      // By name, with the slug as the tie-break — two pods can resolve to the
      // same English name, and without a second key their order is the
      // garden's, which is Mongo's, and would shuffle between visits.
      .sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug));
  } catch {
    all = null;
  }

  if (all === null) {
    return (
      <article>
        <h1 className="mb-4 font-heading text-2xl font-medium tracking-tight">Pods</h1>
        <Alert variant="destructive" role="alert">
          <AlertDescription>Couldn&apos;t load the pods.</AlertDescription>
        </Alert>
      </article>
    );
  }

  const scope = resolveScope(PATH, active);
  const rows = scope ? all.filter((row) => row.plantSlug === scope) : all;

  // Named rather than spelled inline: `as const` on an inline array makes a
  // READONLY tuple, which `FilterGroup["options"]` does not admit — the same
  // move the sprouts and screens pages make.
  const plantOptions = [
    "all",
    ...[...new Set(all.flatMap((row) => (row.plantSlug ? [row.plantSlug] : [])))].sort(),
  ];

  // `scope` rather than `active.plant` for `current`, so the trigger reads what
  // the rows were actually narrowed by: `?plant=all` and a repeated `?plant=`
  // are both "no filter" to `resolveScope`, and a trigger reading either back
  // as a filter would be the chrome contradicting the page.
  const groups: FilterGroup[] = [
    {
      key: "plant",
      options: plantOptions,
      current: scope ?? "all",
      hrefs: plantOptions.map((opt) => filterHref(PATH, active, KEYS, "plant", opt)),
    },
  ];

  return (
    <article>
      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-2xl font-medium tracking-tight">Pods</h1>

        <AdminFilters groups={groups} />

        <p className="text-sm text-muted-foreground">
          showing {rows.length} of {all.length}
        </p>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching pods.</p>
        ) : (
          <PodTable rows={rows} />
        )}
      </div>
    </article>
  );
}
