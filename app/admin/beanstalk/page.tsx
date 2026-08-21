import { resolveText, buildDataset } from "@/lib/data";
import { loadRawGarden } from "@/lib/store";
import { getFederation } from "@/lib/federation";
import { countRefusalsByFeed, listCursors, listPollen, listRefusals } from "@/lib/pollen-store";
import { mergeBeanstalk } from "@/lib/beanstalk";
import { syncNowAction } from "../actions";
import { AdminBar } from "../_components/admin-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

// Admin beanstalk (spec §6): EVERYTHING — every sprout state, every cached
// envelope (private and non-exhibited included), each line with provenance —
// plus the sync operations surface (cursors, refusals, Sync now).
export default async function AdminBeanstalkPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [raw, pollen, cursors, refusals, refusalCounts] = await Promise.all([
    loadRawGarden(),
    listPollen(),
    listCursors(),
    listRefusals(),
    countRefusalsByFeed(),
  ]);
  const data = buildDataset(raw);
  const allBeanSlugs = new Set((raw.beans ?? []).map((b) => b.slug));
  const entries = mergeBeanstalk(data.timelineSprouts(), pollen, allBeanSlugs);
  const { feeds } = getFederation();
  const totalRefusals = Object.values(refusalCounts).reduce((a, b) => a + b, 0);

  return (
    <article>
      <AdminBar current="/admin/beanstalk" />

      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-2xl font-medium tracking-tight">Beanstalk (admin)</h1>
          <a
            href="/beanstalk"
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            public view →
          </a>
        </div>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-lg tracking-tight">Feeds</h2>
            <form action={syncNowAction}>
              <Button type="submit" variant="outline" size="sm">
                Sync now
              </Button>
            </form>
          </div>
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>Sync failed — {error}</AlertDescription>
            </Alert>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>feed</TableHead>
                <TableHead>cursor</TableHead>
                <TableHead>last sync</TableHead>
                <TableHead>status</TableHead>
                <TableHead>refusals</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feeds.map((f) => {
                const c = cursors.find((x) => x.feedId === f.id);
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-heading text-xs">{f.id}</TableCell>
                    <TableCell className="text-muted-foreground">{c?.cursor ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c?.lastSyncAt ?? "never"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c?.lastStatus === "error" ? "destructive" : "secondary"}>
                        {c?.lastStatus ?? "—"}
                      </Badge>
                      {c?.lastError ? (
                        <span className="ml-2 text-xs text-muted-foreground">{c.lastError}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {refusalCounts[f.id] ?? 0}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>

        {refusals.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="font-heading text-lg tracking-tight">
              Refusals{" "}
              <span className="text-muted-foreground">
                (latest {refusals.length} of {totalRefusals})
              </span>
            </h2>
            <ul className="flex flex-col gap-1 font-heading text-xs text-muted-foreground">
              {refusals.map((r) => (
                <li key={`${r.feedId}:${r.rawHash}`} className="flex flex-wrap gap-2">
                  <span className="text-foreground">{r.feedId}</span>
                  <span>{r.reason}</span>
                  <time dateTime={r.at}>{r.at.slice(0, 10)}</time>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg tracking-tight">Entries</h2>
          <ul className="flex flex-col gap-3">
            {entries.map((e) =>
              e.type === "sprout" ? (
                <li key={`sprout:${e.entry.sprout.slug}`} className="flex flex-col gap-1">
                  <span className="text-sm">{resolveText(e.entry.sprout.name)}</span>
                  <span className="flex flex-wrap items-center gap-2 font-heading text-xs text-muted-foreground">
                    <Badge variant="secondary">{e.entry.sprout.state ?? "draft"}</Badge>
                    <time dateTime={e.entry.sprout.date}>{e.date}</time>
                    <span>{e.entry.sprout.type}</span>
                    <span>authored</span>
                  </span>
                </li>
              ) : (
                <li key={`pollen:${e.pollen.id}`} className="flex flex-col gap-1">
                  <span className="text-sm">{resolveText(e.pollen.title)}</span>
                  <span className="flex flex-wrap items-center gap-2 font-heading text-xs text-muted-foreground">
                    <Badge variant="outline">{e.pollen.visibility ?? "unset"}</Badge>
                    <time dateTime={e.pollen.at}>{e.date}</time>
                    <span>{e.pollen.kind}</span>
                    <span>feed:{e.pollen.feedId}</span>
                  </span>
                </li>
              ),
            )}
          </ul>
        </section>
      </div>
    </article>
  );
}
