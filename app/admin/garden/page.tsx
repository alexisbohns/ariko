import { resolveText, textPart } from "@/lib/data";
import { loadRawGarden } from "@/lib/store";
import { AdminBar } from "../_components/admin-bar";
import { roleLine } from "@/lib/plant-role";
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
      href: `/admin/plant/${p.slug}`,
    })),
    ...(raw.pods ?? []).map((p) => ({
      tier: "pod" as const,
      slug: p.slug,
      name: resolveText(p.name),
      visibility: p.visibility ?? "public",
      hasNarrative: textPart(p.content, "en").trim().length > 0,
      // Roles live at the plant tier only — a pod's cell stays empty.
      role: null,
      href: `/admin/pod/${p.slug}`,
    })),
  ].sort((a, b) => a.tier.localeCompare(b.tier) || a.name.localeCompare(b.name));

  return (
    <article>
      <AdminBar current="/admin/garden" />

      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-2xl font-medium tracking-tight">Garden</h1>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>name</TableHead>
              <TableHead>tier</TableHead>
              <TableHead>role</TableHead>
              <TableHead>visibility</TableHead>
              <TableHead>narrative</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.tier}:${row.slug}`}>
                <TableCell>
                  <a href={row.href} className="underline-offset-4 hover:underline">
                    {row.name}
                  </a>
                  <span className="ml-2 font-heading text-xs text-muted-foreground">{row.slug}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{row.tier}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.role ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{row.visibility}</TableCell>
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
