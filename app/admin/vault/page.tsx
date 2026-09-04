import { getFullDataset } from "@/lib/store";
import { resolveText, type TimelineEntry } from "@/lib/data";
import { filterVaultEntries, distinctPlants, distinctTags } from "@/lib/vault";
import { EntityAvatarGlyph } from "@/components/admin/glyphs";
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
import { VaultFilters, type FilterGroup } from "../_components/vault-filters";

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

  // The hrefs are still built here, by vaultHref, so the popovers stay a
  // presentation of links this page already knew how to make.
  const groups: FilterGroup[] = (
    [
      ["state", STATE_OPTIONS],
      ["plant", plantOptions],
      ["tag", tagOptions],
    ] as const
  ).map(([key, options]) => ({
    key,
    options,
    current: active[key] ?? "all",
    hrefs: options.map((opt) => vaultHref(active, key, opt)),
  }));

  return (
    <article>

      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-2xl font-medium tracking-tight">Vault</h1>

        <VaultFilters groups={groups} />

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
                  <TableCell>
                    {e.plant ? (
                      <EntityAvatarGlyph
                        mark={{
                          name: resolveText(e.plant.name),
                          hint: e.plant.slug,
                          ...(e.plant.logo ? { logoUrl: e.plant.logo.url } : {}),
                        }}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
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
