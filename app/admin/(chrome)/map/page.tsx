import { Alert, AlertDescription } from "@/components/ui/alert";
import { resolveScope } from "@/lib/admin-scope";
import { buildGardenMap, mapViewOf } from "@/lib/garden-map";
import { layoutGardenMap, type PositionedMap } from "@/lib/garden-map-layout";
import { listSeeds } from "@/lib/seeds";
import { loadRawGarden } from "@/lib/store";
import { GardenMap } from "../../_components/garden-map";
import { MapToolbar } from "../../_components/map-toolbar";

export const dynamic = "force-dynamic";

const PATH = "/admin/map";

/**
 * The garden as a map: the containment tree, with what waits for review ringed
 * in amber and what is missing chipped on the node. Read-only — every node is
 * a link to the admin page where the actual decision lives.
 *
 * LIVE readers, both: `loadRawGarden` and `listSeeds`, never
 * `loadCachedGarden`. The admin reads live (CLAUDE.md), and a map of "what
 * waits" that lagged a write would show you a garden you had already changed.
 *
 * Scope is `resolveScope`, the one reader of `?plant=`; `?view=` is read here
 * and only here. The page is a `bleed` page (`resolveColumn`): `AdminMain`
 * gives it the whole viewport, so this fills `size-full`.
 */
export default async function AdminMapPage({
  searchParams,
}: {
  searchParams: Promise<{ plant?: string; view?: string }>;
}) {
  const active = await searchParams;
  const scope = resolveScope(PATH, active);
  const view = mapViewOf(active.view);

  let map: PositionedMap | null = null;
  let counts = { all: 0, review: 0, gaps: 0 };
  try {
    const [raw, seeds] = await Promise.all([loadRawGarden(), listSeeds({ status: "inbox" })]);
    const built = buildGardenMap(raw, seeds, { scope, view });
    // Buckets are scaffolding, not garden: counting them would make "All" the
    // only figure that includes things `stats` (rightly) does not.
    counts = {
      all: built.nodes.filter((n) => n.kind !== "bucket").length,
      review: built.stats.waiting,
      gaps: built.stats.gaps,
    };
    map = layoutGardenMap(built);
  } catch {
    map = null;
  }

  if (map === null) {
    return (
      <div className="flex size-full items-center justify-center p-6">
        <Alert variant="destructive" role="alert" className="max-w-md">
          <AlertDescription>Couldn&apos;t load the garden.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (map.nodes.length === 0) {
    return (
      <div className="flex size-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          {scope ? "Nothing in this plant yet." : "The garden is empty."}
        </p>
      </div>
    );
  }

  return (
    <div className="relative size-full">
      {/* Keyed by scope: `fitView` runs once, on mount, so a plant change must
          remount to re-fit. `?view=` is deliberately not in the key — it only
          dims nodes, and the author keeps their pan and zoom. */}
      <GardenMap key={scope ?? "all"} map={map} />
      <MapToolbar active={active} view={view} counts={counts} />
    </div>
  );
}
