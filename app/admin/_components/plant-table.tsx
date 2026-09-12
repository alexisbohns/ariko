import {
  EntityAvatar,
  NarrativeGlyph,
  RoleGlyph,
  StatusGlyph,
} from "@/components/admin/glyphs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PlantStatus, PlantRoleKind, Visibility } from "@/lib/data";

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
  /** Which of the two tables the row belongs to. The table draws no column for
   *  it — the heading above it is the column. */
  visibility: Visibility;
}

/**
 * The root's plant table — rendered twice, once per visibility, which is why
 * it is a component and not markup in the page: two tables that differ only in
 * their rows must not be two pieces of markup that can drift.
 *
 * There is no visibility column, deliberately. The two tables ARE the
 * visibility, and a column repeating the heading of the table it sits in is a
 * column saying nothing. There is no tier column either: only plants are here.
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
            <TableCell>
              <div className="flex items-center gap-2.5">
                <EntityAvatar mark={{ name: row.name, logoUrl: row.logoUrl }} />
                <div className="flex flex-col leading-tight">
                  <a
                    href={`/admin/plant/${encodeURIComponent(row.slug)}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {row.name}
                  </a>
                  <span className="font-heading text-xs text-muted-foreground">{row.slug}</span>
                </div>
              </div>
            </TableCell>
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
