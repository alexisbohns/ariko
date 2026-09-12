import { NarrativeGlyph, RoleGlyph, StatusGlyph } from "@/components/admin/glyphs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PlantStatus, PlantRoleKind } from "@/lib/data";
import { EntityNameCell } from "./table-cells";

export interface PlantRow {
  slug: string;
  name: string;
  logoUrl?: string;
  /** The composed line, resolved by the page rather than by the glyph:
   *  `lib/plant-role.ts` reaches `lib/data.ts`'s runtime half, which the glyph
   *  island may not import. */
  role: { kind: PlantRoleKind; label: string };
  status: PlantStatus;
  hasNarrative: boolean;
}

/**
 * The root's plant table.
 *
 * It exists as a component rather than as markup in the page because the page
 * draws it more than once — the welcome page groups plants by visibility and
 * renders one table per group — and two pieces of markup that differ only in
 * their rows are two pieces of markup that can drift.
 *
 * There is no visibility column, deliberately: where the tables ARE the
 * grouping, a column repeating the heading above it is a column saying
 * nothing. Nor does a row CARRY its visibility. The caller groups before it
 * builds rows, so the grouping key never enters the draw contract and no
 * future caller has to supply a field this component ignores. There is no tier
 * column either — only plants are here.
 */
export function PlantTable({ rows }: { rows: PlantRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>name</TableHead>
          <TableHead>role</TableHead>
          <TableHead>status</TableHead>
          <TableHead>narrative</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.slug}>
            <EntityNameCell
              href={`/admin/plant/${encodeURIComponent(row.slug)}`}
              name={row.name}
              slug={row.slug}
              avatar={{ name: row.name, logoUrl: row.logoUrl }}
            />
            <TableCell className="text-muted-foreground">
              <RoleGlyph kind={row.role.kind} label={row.role.label} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              <StatusGlyph status={row.status} />
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
