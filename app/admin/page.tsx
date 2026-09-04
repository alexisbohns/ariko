import { type Plant, type Seed, resolveText } from "@/lib/data";
import { listSeeds } from "@/lib/seeds";
import { loadRawGarden } from "@/lib/store";
import { SeedOverlay } from "./_components/seed-overlay";
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

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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

  return (
    <article>
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-medium tracking-tight">
              Inbox{" "}
              {seeds ? <span className="text-muted-foreground">({seeds.length})</span> : null}
            </h1>
            <div className="ml-auto">
              <SeedOverlay error={error} inboxCount={seeds?.length ?? 0} />
            </div>
          </div>
          {seeds === null ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>Couldn&apos;t load the inbox.</AlertDescription>
            </Alert>
          ) : seeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inbox empty.</p>
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
                {seeds.map((c) => (
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
                    <TableCell className="text-muted-foreground">{noteSnippet(c.body)}</TableCell>
                    <TableCell className="text-muted-foreground">{mediaLabel(c.media)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {ageLabel(c.createdAt, now)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </article>
  );
}
