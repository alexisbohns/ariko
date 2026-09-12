import { NarrativeGlyph, VisibilityGlyph, type EntityMark } from "@/components/admin/glyphs";
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
 * Pod rows, wherever pod rows are drawn — `/admin/pods` and a plant hub's
 * preview of the same pods, out of one file, so the section and the preview
 * cannot disagree about what a pod row looks like.
 *
 * Two parameters carry the difference. `limit` is for a preview: it draws the
 * first n rows and says nothing about the rest, so any "n more" line belongs
 * to the caller, which is the only side that knows the full count. `showPlant`
 * drops the plant column, because a hub is already inside a plant and a column
 * repeating it would be noise.
 *
 * `showPlant` is a boolean because there is one axis here with two states. If
 * a second ever appears — a bean list narrowed by pod, say — the move is a
 * single `scope?: "plant" | "pod"`, since the page already knows what it
 * narrowed by, rather than a second boolean and eight nominal states of which
 * most are nonsense.
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
  // `limit === undefined`, not `limit ?` — a computed limit reaches zero
  // legitimately (the slots left in a preview), and a falsy test would read
  // that as "no limit" and dump the whole table into the card.
  const shown = limit === undefined ? rows : rows.slice(0, limit);
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
            <EntityNameCell
              href={`/admin/pod/${encodeURIComponent(row.slug)}`}
              name={row.name}
              slug={row.slug}
            />
            {showPlant ? <MarkCell mark={row.plant} /> : null}
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
