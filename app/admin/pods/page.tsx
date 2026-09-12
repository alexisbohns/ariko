import type { EntityMark } from "@/components/admin/glyphs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { plantFilterGroup, resolveScope } from "@/lib/admin-scope";
import { PLANT_PREFIX, buildDataset, parentsWithPrefix, resolveText, textPart } from "@/lib/data";
import { byResolvedName } from "@/lib/name-order";
import { loadRawGarden } from "@/lib/store";
import { AdminFilters, type FilterGroup } from "../_components/admin-filters";
import { PodTable, type PodRow } from "../_components/pod-table";

export const dynamic = "force-dynamic";

const PATH = "/admin/pods";

/**
 * A row plus every plant slug it names.
 *
 * `PodRow.plant` is a MARK — a name and an optional logo, resolved so the
 * table can draw it — and a pod whose plant ref resolves to nothing has no
 * mark at all. So the mark cannot be what the filter compares; the raw refs
 * ride alongside it for that.
 *
 * ALL of them, not the first. `buildDataset` indexes a pod under EVERY
 * resolvable plant it names, so `Dataset.podsForPlant` answers for a pod
 * parented to two plants twice — and a section that compared only
 * `parents[0]` would show that pod under one plant while a hub built from
 * `podsForPlant` showed it under both, two counts for one question.
 */
interface Row extends PodRow {
  plantSlugs: string[];
}

/**
 * The pod index, narrowed by plant.
 *
 * Pods were half of `/admin/garden`, in a table that had to carry a tier
 * column before it could say anything — one section per tier means these
 * columns are the pod's own: its beans, its visibility, whether it holds
 * narrative.
 *
 * `PodTable` draws the rows and a plant hub's preview renders the same
 * component, so the two cannot drift about what a pod row IS; `limit` and
 * `showPlant` are what differ. Here the plant column stays, because the index
 * spans every plant and a pod row that does not name its plant says almost
 * nothing.
 *
 * **Narrowing compares the plant REFS in `parents`, and a pod matches on any
 * of them.** That is `buildDataset`'s own rule read back: it files a pod under
 * every plant parent that resolves, so for any plant the garden actually holds,
 * "this row names it" and "`podsForPlant` returns it" are the same set, and
 * this section's count and a hub's preview count cannot disagree.
 *
 * What the refs deliberately do NOT do is resolve. An unrooted pod, and one
 * naming a plant the garden no longer holds, are the same case to the table —
 * both draw the em dash rather than a wrong name — but they are not the same
 * case to the filter: `?plant=` on a slug nothing resolves narrows to the pods
 * that still name it, which is how you find them. The MARK is the other half
 * of that: it is the first ref that resolves, not the first ref, so a pod whose
 * first parent dangles still draws the plant it really belongs to instead of
 * being filed under a ghost.
 *
 * The scope itself comes from `resolveScope`, the one reader of `?plant=`, and
 * `AdminChrome` reads it from there too — so the plant the switcher shows and
 * the plant these rows were narrowed by are one value, not two readings of a
 * URL.
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
        const plantSlugs = parentsWithPrefix(pod.parents, PLANT_PREFIX);
        // The first ref that RESOLVES, not the first ref: a pod whose first
        // parent dangles and whose second is real belongs to the second, and
        // drawing the em dash for it would file it under a plant that will
        // never find it.
        const named = plantSlugs.find((slug) => marks.has(slug));
        const plant = named ? marks.get(named) : undefined;
        return {
          slug: pod.slug,
          name: resolveText(pod.name),
          visibility: pod.visibility ?? "public",
          hasNarrative: textPart(pod.content, "en").trim().length > 0,
          beanCount: dataset.beansForPod(pod.slug).length,
          plantSlugs,
          ...(plant ? { plant } : {}),
        };
      })
      .sort(byResolvedName);
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
  const rows = scope ? all.filter((row) => row.plantSlugs.includes(scope)) : all;
  const hidden = all.length - rows.length;

  const groups: FilterGroup[] = [
    plantFilterGroup(
      PATH,
      active,
      all.flatMap((row) => row.plantSlugs),
      scope,
    ),
  ];

  return (
    <article>
      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-2xl font-medium tracking-tight">Pods</h1>

        {/* An empty section and an empty filter are two different sentences,
            and the page has to know which it is BEFORE it blames a filter:
            with no pods at all, "No matching pods" accuses a control the
            author never touched. The inbox branches the same way — `Inbox
            empty.` against `No seeds suggest this plant.` */}
        {all.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pods yet.</p>
        ) : (
          <>
            <AdminFilters groups={groups} />

            <p className="text-sm text-muted-foreground">
              showing {rows.length} of {all.length}
            </p>

            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pods name this plant.</p>
            ) : (
              <PodTable rows={rows} />
            )}

            {/* The way back out, script-off. The popover is a client island,
                so without it a narrowed page that drew no rows would be a dead
                end — the inbox's affordance, for the same reason. */}
            {hidden > 0 ? (
              <p className="text-sm text-muted-foreground">
                <a href={PATH} className="underline-offset-4 hover:underline">
                  {hidden} more under All
                </a>
              </p>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}
