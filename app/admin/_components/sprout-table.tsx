import { EntityAvatarGlyph } from "@/components/admin/glyphs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { resolveText, type TimelineEntry } from "@/lib/data";

/**
 * Sprout rows — `/admin/sprouts` and the hub's preview, one file, two callers.
 *
 * It takes `TimelineEntry[]` rather than a prepared row type, unlike its three
 * siblings: a timeline entry already carries the sprout with its bean and its
 * plant resolved, so a row shape here would be that entry re-typed, and the one
 * caller that exists would spend a `.map` restating it.
 */
export function SproutTable({
  entries,
  limit,
  showPlant = true,
}: {
  entries: TimelineEntry[];
  limit?: number;
  showPlant?: boolean;
}) {
  const shown = limit ? entries.slice(0, limit) : entries;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>sprout</TableHead>
          <TableHead>state</TableHead>
          {showPlant ? <TableHead>plant</TableHead> : null}
          <TableHead>bean</TableHead>
          <TableHead>date</TableHead>
          <TableHead>tags</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shown.map((e) => (
          <TableRow key={e.sprout.slug}>
            <TableCell>
              {e.bean ? (
                <a
                  href={`/admin/bean/${encodeURIComponent(e.bean.slug)}`}
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
            {showPlant ? (
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
            ) : null}
            <TableCell className="text-muted-foreground">{e.bean?.slug ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{e.sprout.date}</TableCell>
            <TableCell className="text-muted-foreground">
              {(e.sprout.tags ?? []).join(", ") || "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
