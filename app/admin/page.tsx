import { type Seed, resolveText } from "@/lib/data";
import { listSeeds } from "@/lib/seeds";
import { SeedOverlay } from "./_components/seed-overlay";
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
                    <TableCell className="text-muted-foreground">{c.source.kind}</TableCell>
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
