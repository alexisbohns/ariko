import {
  EntityAvatarGlyph,
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

export interface BeanRow {
  slug: string;
  name: string;
  visibility: Visibility;
  sproutCount: number;
  /** The pod that holds it, where one does — a bean may skip the pod tier. */
  pod?: string;
  plant?: EntityMark;
}

/**
 * Bean rows — `/admin/beans` and the hub's preview, one file, two callers.
 *
 * A sibling of `PodTable` rather than a generalisation of it: the two tables
 * rhyme, but a shared config object able to express both columns sets would run
 * longer than the two written out.
 */
export function BeanTable({
  rows,
  limit,
  showPlant = true,
}: {
  rows: BeanRow[];
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
          <TableHead>pod</TableHead>
          <TableHead>sprouts</TableHead>
          <TableHead>visibility</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shown.map((row) => (
          <TableRow key={row.slug}>
            <TableCell>
              <div className="flex flex-col leading-tight">
                <a
                  href={`/admin/bean/${encodeURIComponent(row.slug)}`}
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
            <TableCell className="text-muted-foreground">{row.pod ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{row.sproutCount}</TableCell>
            <TableCell>
              <VisibilityGlyph visibility={row.visibility} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
