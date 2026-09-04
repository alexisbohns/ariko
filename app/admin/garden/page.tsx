import { resolveText, textPart } from "@/lib/data";
import { loadRawGarden } from "@/lib/store";
import { roleLine } from "@/lib/plant-role";
import { statusLabel, statusOf } from "@/lib/plant-status";
import { EntityAvatar, TierGlyph, VisibilityGlyph } from "@/components/admin/glyphs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

/**
 * Plants and pods, the two tiers that hold narrative. Mechanical — the vault
 * stays sprout-centric, and this is the only way to reach a container page
 * without typing its URL.
 */
export default async function AdminGardenPage() {
  const raw = await loadRawGarden();

  const rows = [
    ...(raw.plants ?? []).map((p) => ({
      tier: "plant" as const,
      slug: p.slug,
      name: resolveText(p.name),
      visibility: p.visibility ?? "public",
      hasNarrative: textPart(p.content, "en").trim().length > 0,
      role: roleLine(p.role),
      status: statusLabel(statusOf(p)),
      // A plant has a mark; a pod never does (no `logo` field at that tier), so
      // its avatar is always the initials fallback — which is exactly why the
      // avatar primitive is the right thing here rather than a bare <img>.
      logoUrl: p.logo?.url,
      href: `/admin/plant/${p.slug}`,
    })),
    ...(raw.pods ?? []).map((p) => ({
      tier: "pod" as const,
      slug: p.slug,
      name: resolveText(p.name),
      visibility: p.visibility ?? "public",
      hasNarrative: textPart(p.content, "en").trim().length > 0,
      // Roles and statuses live at the plant tier only — a pod's cells stay
      // empty. A pod under an inactive plant IS inactive, by containment; a
      // second stored flag would be a second source of truth.
      role: null,
      status: null,
      logoUrl: undefined,
      href: `/admin/pod/${p.slug}`,
    })),
  ].sort((a, b) => a.tier.localeCompare(b.tier) || a.name.localeCompare(b.name));

  return (
    <article>

      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-2xl font-medium tracking-tight">Garden</h1>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>name</TableHead>
              <TableHead>tier</TableHead>
              <TableHead>role</TableHead>
              <TableHead>status</TableHead>
              <TableHead>visibility</TableHead>
              <TableHead>narrative</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.tier}:${row.slug}`}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <EntityAvatar mark={{ name: row.name, logoUrl: row.logoUrl }} />
                    <div className="flex flex-col leading-tight">
                      <a href={row.href} className="underline-offset-4 hover:underline">
                        {row.name}
                      </a>
                      <span className="font-heading text-xs text-muted-foreground">{row.slug}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <TierGlyph tier={row.tier} />
                </TableCell>
                <TableCell className="text-muted-foreground">{row.role ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{row.status ?? "—"}</TableCell>
                <TableCell>
                  <VisibilityGlyph visibility={row.visibility} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.hasNarrative ? "yes" : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </article>
  );
}
