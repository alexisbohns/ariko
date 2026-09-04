import { getFullDataset } from "@/lib/store";
import { resolveText, type TimelineEntry } from "@/lib/data";
import { filterVaultEntries, distinctPlants, distinctTags } from "@/lib/vault";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const STATE_OPTIONS = ["all", "draft", "private", "published"];

type Active = { state?: string; plant?: string; tag?: string };

// Build a filter link that sets one dimension to `value` (or clears it when "all")
// while preserving the other active filters. Zero-JS — plain hrefs.
function vaultHref(active: Active, key: keyof Active, value: string): string {
  const merged: Active = { ...active, [key]: value };
  const params = new URLSearchParams();
  for (const k of ["state", "plant", "tag"] as const) {
    const v = merged[k];
    if (v && v !== "all") params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/admin/vault?${qs}` : "/admin/vault";
}

export default async function VaultPage({
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
        <h1 className="mb-4 font-heading text-2xl font-medium tracking-tight">Vault</h1>
        <Alert variant="destructive" role="alert">
          <AlertDescription>Couldn&apos;t load the vault.</AlertDescription>
        </Alert>
      </article>
    );
  }

  const entries = filterVaultEntries(all, active);
  const plantOptions = ["all", ...distinctPlants(all)];
  const tagOptions = ["all", ...distinctTags(all)];

  const filterRow = (label: string, key: keyof Active, options: string[]) => {
    const current = active[key] ?? "all";
    return (
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="w-12 shrink-0 font-heading text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        {options.map((opt) =>
          opt === current ? (
            <Badge key={opt}>{opt}</Badge>
          ) : (
            <a key={opt} href={vaultHref(active, key, opt)}>
              <Badge variant="outline" className="transition-colors hover:bg-accent">
                {opt}
              </Badge>
            </a>
          ),
        )}
      </div>
    );
  };

  return (
    <article>

      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-2xl font-medium tracking-tight">Vault</h1>

        <div className="flex flex-col gap-3">
          {filterRow("state", "state", STATE_OPTIONS)}
          {filterRow("plant", "plant", plantOptions)}
          {filterRow("tag", "tag", tagOptions)}
        </div>

        <p className="text-sm text-muted-foreground">
          showing {entries.length} of {all.length}
        </p>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching sprouts.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>sprout</TableHead>
                <TableHead>state</TableHead>
                <TableHead>plant</TableHead>
                <TableHead>bean</TableHead>
                <TableHead>date</TableHead>
                <TableHead>tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.sprout.slug}>
                  <TableCell>
                    {e.bean ? (
                      <a
                        href={`/admin/bean/${e.bean.slug}`}
                        className="underline-offset-4 transition-colors hover:underline"
                      >
                        {resolveText(e.sprout.name)}
                      </a>
                    ) : (
                      resolveText(e.sprout.name)
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{e.sprout.state ?? "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.plant?.slug ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.bean?.slug ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.sprout.date}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {(e.sprout.tags ?? []).join(", ") || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </article>
  );
}
