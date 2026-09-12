import { VisibilityGlyph, type EntityMark } from "@/components/admin/glyphs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Visibility } from "@/lib/data";
import { EntityNameCell, MarkCell } from "./table-cells";

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
 * Bean rows, wherever bean rows are drawn — `/admin/beans` and a plant hub's
 * preview, out of one file.
 *
 * A sibling of `PodTable` rather than a specialisation of it. The two rhyme
 * closely enough to tempt one table driven by a column config; what they
 * actually share is two cells, and those are extracted into
 * `table-cells.tsx`, which argues the rest of that case. The columns here are
 * written out because which columns a bean has is the substance of this file.
 *
 * `limit` and `showPlant` mean what they mean in `PodTable`: `limit` draws the
 * first n and leaves any "n more" line to the caller, which is the only side
 * that knows the full count; `showPlant` drops a column a hub already answers.
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
  // See `PodTable`: zero is a limit, not the absence of one.
  const shown = limit === undefined ? rows : rows.slice(0, limit);
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
            <EntityNameCell
              href={`/admin/bean/${encodeURIComponent(row.slug)}`}
              name={row.name}
              slug={row.slug}
            />
            {showPlant ? <MarkCell mark={row.plant} /> : null}
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
