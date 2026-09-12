import {
  EntityAvatarGlyph,
  NarrativeGlyph,
  VisibilityGlyph,
  type EntityMark,
} from "@/components/admin/glyphs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Visibility } from "@/lib/data";

export interface PodRow {
  slug: string;
  name: string;
  visibility: Visibility;
  hasNarrative: boolean;
  beanCount: number;
  /** The plant that holds it. Absent when the pod is unrooted, or when its
   *  named plant resolves to nothing — drawn as the em dash rather than as a
   *  wrong name. */
  plant?: EntityMark;
}

/**
 * Pod rows — `/admin/pods` and the hub's preview, one file, two callers.
 * `limit` is what differs; `showPlant` is the other parameter, because the hub
 * is already inside a plant and a column repeating it would be noise.
 */
export function PodTable({
  rows,
  limit,
  showPlant = true,
}: {
  rows: PodRow[];
  limit?: number;
  showPlant?: boolean;
}) {
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>name</TableHead>
          {showPlant ? <TableHead>plant</TableHead> : null}
          <TableHead>beans</TableHead>
          <TableHead>visibility</TableHead>
          <TableHead>narrative</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shown.map((row) => (
          <TableRow key={row.slug}>
            <TableCell>
              <div className="flex flex-col leading-tight">
                <a
                  href={`/admin/pod/${encodeURIComponent(row.slug)}`}
                  className="underline-offset-4 hover:underline"
                >
                  {row.name}
                </a>
                <span className="font-heading text-xs text-muted-foreground">{row.slug}</span>
              </div>
            </TableCell>
            {showPlant ? (
              <TableCell>
                {row.plant ? (
                  <EntityAvatarGlyph mark={row.plant} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            ) : null}
            <TableCell className="text-muted-foreground">{row.beanCount}</TableCell>
            <TableCell>
              <VisibilityGlyph visibility={row.visibility} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {row.hasNarrative ? <NarrativeGlyph /> : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
