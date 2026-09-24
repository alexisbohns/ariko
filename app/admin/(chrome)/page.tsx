import { Alert, AlertDescription } from "@/components/ui/alert";
import { hasNarrative, resolveText, type Plant } from "@/lib/data";
import { greeting } from "@/lib/greeting";
import { byResolvedName } from "@/lib/name-order";
import { roleLine } from "@/lib/plant-role";
import { statusOf } from "@/lib/plant-status";
import { visibilityOf } from "@/lib/plant-visibility";
import { loadRawGarden } from "@/lib/store";
import { PaletteSearch } from "../_components/palette-search";
import { PlantTable, type PlantRow } from "../_components/plant-table";

export const dynamic = "force-dynamic";

/**
 * One plant, as the table draws it.
 *
 * The composed role line is resolved HERE rather than in the glyph: the glyph
 * is a client island and `lib/plant-role.ts` reaches lib/data's runtime half.
 */
function toRow(plant: Plant): PlantRow {
  return {
    slug: plant.slug,
    name: resolveText(plant.name),
    ...(plant.logo?.url ? { logoUrl: plant.logo.url } : {}),
    role: { kind: plant.role.kind, label: roleLine(plant.role) },
    status: statusOf(plant),
    hasNarrative: hasNarrative(plant.content),
  };
}

/** In `byResolvedName`'s order, which is the switcher's order too — so the
 *  first plant in the chrome and the first plant in this table are the same
 *  plant. */
function rowsFor(plants: Plant[]): PlantRow[] {
  return plants.map(toRow).sort(byResolvedName);
}

/**
 * The admin's front door, and the whole point of the scope slice: the garden
 * used to open onto a table of plants AND pods, with a tier column to say which
 * was which and a visibility column to say which state each was in. Both
 * columns were the table apologising for mixing lists that were never one list.
 *
 * Here a plant is the subject. Published and private are two tables rather than
 * a column, and pods are not on this page at all — a pod without its plant is a
 * row that must say which plant it belongs to before it can say anything else,
 * which is exactly the column the old table needed.
 *
 * The PLANTS are grouped before the rows are built, not after: `PlantRow` has
 * no visibility field, deliberately, so the grouping key never enters the
 * table's draw contract (`_components/plant-table.tsx`).
 *
 * `loadRawGarden`, not `loadCachedGarden`: this is the admin, and an author who
 * has just saved a plant must see it here on the next render rather than
 * whenever the `garden` tag next turns over.
 */
export default async function AdminPage() {
  let tables: { published: PlantRow[]; private: PlantRow[] } | null = null;
  try {
    const plants = (await loadRawGarden()).plants ?? [];
    tables = {
      published: rowsFor(plants.filter((plant) => visibilityOf(plant) === "public")),
      // `!== "public"` rather than `=== "private"`: every plant belongs to
      // exactly one of the two tables, whatever the vocabulary grows to.
      private: rowsFor(plants.filter((plant) => visibilityOf(plant) !== "public")),
    };
  } catch {
    tables = null;
  }

  return (
    <article className="flex flex-col gap-10">
      <section className="flex flex-col items-center gap-6 pt-4">
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          {greeting(new Date())}
        </h1>
        <PaletteSearch />
      </section>

      {tables === null ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>Couldn&apos;t load the garden.</AlertDescription>
        </Alert>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="font-heading text-lg tracking-tight">
              Published <span className="text-muted-foreground">({tables.published.length})</span>
            </h2>
            {tables.published.length === 0 ? (
              <p className="text-sm text-muted-foreground">No published plants.</p>
            ) : (
              <PlantTable rows={tables.published} />
            )}
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="font-heading text-lg tracking-tight">
              Private <span className="text-muted-foreground">({tables.private.length})</span>
            </h2>
            {tables.private.length === 0 ? (
              <p className="text-sm text-muted-foreground">No private plants.</p>
            ) : (
              <PlantTable rows={tables.private} />
            )}
          </section>
        </>
      )}
    </article>
  );
}
