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
import { MarkCell } from "./table-cells";

/**
 * Sprout rows, wherever sprout rows are drawn — `/admin/sprouts` and a plant
 * hub's preview, out of one file. The table this draws is the one that lived
 * inside `/admin/sprouts`, lifted whole: the same six columns, the same Badge,
 * the same avatar in the plant cell.
 *
 * It takes `TimelineEntry[]` rather than a prepared row type, unlike its three
 * siblings, for two reasons that do not expire. A timeline entry already
 * carries the sprout with its bean and its plant resolved, so a row type here
 * would be that entry re-typed and every caller would restate it. And this
 * file therefore imports `resolveText` as a VALUE from `lib/data.ts`, which
 * opens with `node:fs` — so a `"use client"` added here fails the build
 * outright rather than silently shipping a table to the browser. That is a
 * guard the three type-only tables do not have, which is why
 * `lib/admin-table-source.test.ts` has to assert for all five what this one
 * enforces for itself.
 *
 * `limit` and `showPlant` mean what they mean in `PodTable`: `limit` draws the
 * first n and leaves any "n more" line to the caller, which is the only side
 * that knows the full count; `showPlant` drops a column a hub already answers.
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
  // See `PodTable`: zero is a limit, not the absence of one.
  const shown = limit === undefined ? entries : entries.slice(0, limit);
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
              <MarkCell
                mark={
                  e.plant
                    ? {
                        name: resolveText(e.plant.name),
                        hint: e.plant.slug,
                        ...(e.plant.logo ? { logoUrl: e.plant.logo.url } : {}),
                      }
                    : undefined
                }
              />
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
