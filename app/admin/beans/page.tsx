import { Alert, AlertDescription } from "@/components/ui/alert";
import { filterHref } from "@/lib/admin-filters";
import { resolveScope, scopeKeysFor } from "@/lib/admin-scope";
import { POD_PREFIX, buildDataset, parentsWithPrefix, resolveText } from "@/lib/data";
import { beansForPlantDeep } from "@/lib/plant-hub";
import { loadRawGarden } from "@/lib/store";
import { AdminFilters, type FilterGroup } from "../_components/admin-filters";
import { BeanTable, type BeanRow } from "../_components/bean-table";

export const dynamic = "force-dynamic";

const PATH = "/admin/beans";

// The accessor, not a bare index: `tsconfig.json` has `strict` without
// `noUncheckedIndexedAccess`, so a bare `scopeKeys[PATH]` is typed as always
// present and a renamed path would reach `filterQuery` as undefined — "keys is
// not iterable" at runtime, clean through `tsc`, `npm test` and `npm run build`.
const KEYS = scopeKeysFor(PATH) ?? [];

/**
 * The bean index — the tier that has never had one, narrowed by plant and by
 * pod.
 *
 * **The plant dimension goes through `beansForPlantDeep`, never through the
 * row's own plant.** A plant's beans are its direct ones PLUS every one of its
 * pods', and that union is `lib/plant-hub.ts`'s whole reason to exist: the
 * hub's bean preview counts with the same function, so `?plant=x` here and the
 * count on x's hub are the same number by construction rather than by two
 * pieces of arithmetic that happen to agree today. A row's `plant` column is a
 * different question with a different answer — `Dataset.plantForBean` gives a
 * DIRECT plant parent precedence over the pod's — so a bean parented to one
 * plant's pod and to another plant outright appears under both, and draws the
 * one it names itself.
 *
 * The pod dimension has no popover. `lib/admin-scope.ts` declares it for this
 * route, so `?pod=` survives a click on the plant filter and must therefore
 * mean something — a declared dimension nothing reads is a query key that
 * rides along and changes nothing. What it lacks is a control: the filter bar
 * keys its dimensions to their own initial and `p` is already the plant
 * popover's, so this one is meant to be arrived at by link rather than
 * browsed. Nothing links to it yet; a pod's own page is the obvious first
 * caller.
 */
export default async function AdminBeansPage({
  searchParams,
}: {
  searchParams: Promise<{ plant?: string; pod?: string }>;
}) {
  const active = await searchParams;
  const scope = resolveScope(PATH, active);

  let all: BeanRow[] | null = null;
  let plantOptions: string[] = ["all"];
  // The scoped plant's bean slugs, or null for "no plant filter". Built inside
  // the read below because it needs the dataset, which does not outlive it.
  let scoped: Set<string> | null = null;
  try {
    const raw = await loadRawGarden();
    const dataset = buildDataset(raw);

    all = (raw.beans ?? [])
      .map((bean) => {
        const podSlug = parentsWithPrefix(bean.parents, POD_PREFIX)[0];
        const plant = dataset.plantForBean(bean.slug);
        return {
          slug: bean.slug,
          name: resolveText(bean.name),
          visibility: bean.visibility ?? "public",
          sproutCount: dataset.sproutsForBean(bean.slug).length,
          ...(podSlug ? { pod: podSlug } : {}),
          ...(plant
            ? {
                plant: {
                  name: resolveText(plant.name),
                  hint: plant.slug,
                  ...(plant.logo ? { logoUrl: plant.logo.url } : {}),
                },
              }
            : {}),
        };
      })
      // By name, with the slug as the tie-break — two beans can resolve to the
      // same English name, and without a second key their order is the
      // garden's, which is Mongo's, and would shuffle between visits.
      .sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug));

    // The options are the plants the filter can actually find beans for,
    // computed by the very function that does the finding. Built from the rows'
    // plant marks instead, a plant whose only beans are held by its pods and
    // ALSO name another plant directly would be missing from a list that
    // narrows to them perfectly well.
    plantOptions = [
      "all",
      ...dataset
        .getPlants()
        .map((plant) => plant.slug)
        .filter((slug) => beansForPlantDeep(dataset, slug).length > 0)
        .sort(),
    ];

    scoped = scope ? new Set(beansForPlantDeep(dataset, scope).map((bean) => bean.slug)) : null;
  } catch {
    all = null;
  }

  if (all === null) {
    return (
      <article>
        <h1 className="mb-4 font-heading text-2xl font-medium tracking-tight">Beans</h1>
        <Alert variant="destructive" role="alert">
          <AlertDescription>Couldn&apos;t load the beans.</AlertDescription>
        </Alert>
      </article>
    );
  }

  // `String(...)` and the "all" check for the reasons `filterQuery` and
  // `resolveScope` give: a REPEATED `?pod=` reaches this page as an array,
  // which the type above does not admit but a URL can always produce, and
  // "all" is how a filter URL spells "no filter" — a raw read would narrow to
  // a pod named "a,b" or to one named "all", and both match nothing while
  // looking like a filter that does.
  const podValue = String(active.pod ?? "").trim();
  const inPod = podValue && podValue !== "all" ? podValue : null;

  const rows = all.filter(
    (row) => (scoped ? scoped.has(row.slug) : true) && (inPod ? row.pod === inPod : true),
  );

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
        <h1 className="font-heading text-2xl font-medium tracking-tight">Beans</h1>

        <AdminFilters groups={groups} />

        <p className="text-sm text-muted-foreground">
          showing {rows.length} of {all.length}
        </p>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching beans.</p>
        ) : (
          <BeanTable rows={rows} />
        )}
      </div>
    </article>
  );
}
