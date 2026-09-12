import { type Plant, type Seed, resolveText } from "@/lib/data";
import { listSeeds } from "@/lib/seeds";
import { loadRawGarden } from "@/lib/store";
import { plantFilterGroup, resolveScope } from "@/lib/admin-scope";
import { filterSeedsByPlant } from "@/lib/inbox-filter";
import { SeedOverlay } from "../../_components/seed-overlay";
import { AdminFilters, type FilterGroup } from "../../_components/admin-filters";
import { SeedSourceGlyph, type EntityMark } from "@/components/admin/glyphs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const PATH = "/admin/inbox";

function noteSnippet(body: Seed["body"]): string {
  const text = body?.en || body?.fr || "";
  if (!text) return "—";
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

function mediaLabel(media: Seed["media"]): string {
  if (media.length === 0) return "—";
  if (media.length === 1) return `1 ${media[0].kind}`;
  return `${media.length} items`;
}

// The suggested plant, resolved against the garden — never trusted as a label.
// `suggested.plantSlug` arrives over the wire from a sibling repo's lab note
// (lib/inbox.ts aliases the legacy `moleculeSlug` onto it), so it can name a
// plant that was renamed or never existed. A miss draws NOTHING: an avatar for
// an entity the garden cannot show is worse than an unadorned source icon.
function plantMark(seed: Seed, plants: Map<string, Plant>): EntityMark | undefined {
  const slug = seed.suggested?.plantSlug;
  if (!slug) return undefined;
  const plant = plants.get(slug);
  if (!plant) return undefined;
  return {
    name: resolveText(plant.name),
    hint: plant.slug,
    ...(plant.logo ? { logoUrl: plant.logo.url } : {}),
  };
}

function ageLabel(createdAt: string, now: number): string {
  const then = Date.parse(createdAt);
  if (Number.isNaN(then)) return "—";
  const secs = Math.max(0, Math.round((now - then) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

/**
 * The inbox, narrowed by the plant a seed SUGGESTS.
 *
 * The rule itself is `lib/inbox-filter.ts`, not this page: a seed that
 * suggests nothing is not evidence of membership, so it appears under All and
 * under no plant — the same refusal `plantMark` above makes when it declines
 * to draw an avatar for a suggestion the garden cannot resolve. The scope
 * itself comes from `resolveScope`, the one reader of `?plant=`, so every
 * surface that asks what a URL is scoped to gets the same answer — the table,
 * the filter trigger below it, and whatever else comes to ask.
 *
 * The heading carries BOTH numbers while a scope is active — `Inbox (3 of 11)`
 * — and a narrowed queue that hides rows says how many more are under All,
 * because the failure to avoid here is an author reading a narrowed inbox as
 * an empty one and capturing a seed they already have.
 *
 * `SeedOverlay`'s `inboxCount` stays the UNFILTERED total on purpose: it is
 * how the overlay detects that a save landed (one more seed than it last saw)
 * and closes itself. Handed the narrowed count, a capture whose suggestion
 * falls outside the current scope would leave the count unchanged, and the
 * overlay would sit open over a seed that was in fact saved.
 */
export default async function AdminInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; plant?: string }>;
}) {
  const active = await searchParams;
  const { error } = active;

  let seeds: Seed[] | null = null;
  try {
    seeds = await listSeeds({ status: "inbox" });
  } catch {
    seeds = null; // rendered as a load-failure line below
  }

  // The garden is read only to draw the source column's avatars. It is loaded
  // separately from the seeds and fails separately too: an unreachable garden
  // costs the marks, never the inbox.
  let plants = new Map<string, Plant>();
  try {
    plants = new Map(((await loadRawGarden()).plants ?? []).map((p) => [p.slug, p]));
  } catch {
    plants = new Map();
  }

  const now = Date.now();

  const scope = resolveScope(PATH, active);
  const total = seeds?.length ?? 0;
  const visible = filterSeedsByPlant(seeds ?? [], scope);
  const hidden = total - visible.length;

  // The options are the slugs the queue actually SUGGESTS, not the garden's
  // plants: an option that matches nothing is a click that empties the table
  // for no reason, and a suggestion naming a plant the garden no longer holds
  // still needs a way to be found. `plantFilterGroup` dedupes and sorts them,
  // and spells the "All" option and the trigger's current value from the one
  // place that decides what the sentinel is.
  //
  // This route's dimension list is `["plant"]`, so the hrefs it builds drop
  // `?error=` on the way out — the behaviour wanted: a filter click is not a
  // re-run of the save that failed, and the overlay should not reopen onto a
  // stale banner.
  const groups: FilterGroup[] = [
    plantFilterGroup(
      PATH,
      active,
      (seeds ?? []).flatMap((seed) =>
        seed.suggested?.plantSlug ? [seed.suggested.plantSlug] : [],
      ),
      scope,
    ),
  ];

  return (
    <article>
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-medium tracking-tight">
              Inbox{" "}
              {seeds ? (
                <span className="text-muted-foreground">
                  ({scope ? `${visible.length} of ${total}` : total})
                </span>
              ) : null}
            </h1>
            <div className="ml-auto">
              <SeedOverlay error={error} inboxCount={total} />
            </div>
          </div>
          {seeds === null ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>Couldn&apos;t load the inbox.</AlertDescription>
            </Alert>
          ) : seeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inbox empty.</p>
          ) : (
            <>
              <AdminFilters groups={groups} />
              {visible.length === 0 ? (
                <p className="text-sm text-muted-foreground">No seeds suggest this plant.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>source</TableHead>
                      <TableHead>title</TableHead>
                      <TableHead>note</TableHead>
                      <TableHead>media</TableHead>
                      <TableHead>age</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <SeedSourceGlyph kind={c.source.kind} plant={plantMark(c, plants)} />
                        </TableCell>
                        <TableCell>
                          <a
                            href={`/admin/triage/${c.id}`}
                            className="underline-offset-4 transition-colors hover:underline"
                          >
                            {resolveText(c.title)}
                          </a>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {noteSnippet(c.body)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {mediaLabel(c.media)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {ageLabel(c.createdAt, now)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {scope && hidden > 0 ? (
                <p className="text-sm text-muted-foreground">
                  <a href={PATH} className="underline-offset-4 hover:underline">
                    {hidden} more under All
                  </a>
                </p>
              ) : null}
            </>
          )}
        </section>
      </div>
    </article>
  );
}
