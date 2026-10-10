import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { resolveText, type TimelineEntry } from "@/lib/data";
import { SproutKindGlyph, SproutStateGlyph } from "@/components/admin/glyphs";
import { stateOf } from "@/lib/sprout-state";
import { MarkCell } from "./table-cells";

/**
 * Sprout rows, wherever sprout rows are drawn — `/admin/sprouts` and a plant
 * hub's preview, out of one file. The table this draws is the one that lived
 * inside `/admin/sprouts`, lifted whole, and grown by one: seven columns —
 * sprout, state, kind, plant, about, date, tags — the same glyphs the sprout's
 * own head draws, the same avatar in the plant cell.
 *
 * The `about` column is the journal model's answer to what used to be the
 * `bean` column (spec 2026-10-10 §1.2). A sprout is no longer contained by one
 * bean; it is ABOUT one or more pods and beans, and its plant is derived from
 * them. So the cell lists every `about` ref's slug, prefix stripped, in the
 * order the author gave — not only the first existing bean the entry resolved
 * — because a sprout about two beans is a fact the row should show rather than
 * halve. An entry with no `about` is a plant-level sprout and draws the em
 * dash, the same nothing the tags cell draws.
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
 * `limit`, `showPlant` and `showBean` mean what they mean in `PodTable`: `limit`
 * draws the first n and leaves any "n more" line to the caller, which is the only
 * side that knows the full count; the two flags each drop a column the page
 * around the table already answers.
 */
export function SproutTable({
  entries,
  limit,
  showPlant = true,
  showBean = true,
}: {
  entries: TimelineEntry[];
  limit?: number;
  showPlant?: boolean;
  /**
   * Drops the about column, exactly as `showPlant` drops the plant one and for
   * the identical reason: a column whose value is constant on the page drawing
   * it is a column that says nothing. The bean's own page passes false for
   * both, because every row there is about it. The flag keeps the name it had
   * when the column was `bean`: what it means — "the page already answers which
   * bean" — has not changed, only what the column spells.
   */
  showBean?: boolean;
}) {
  // See `PodTable`: zero is a limit, not the absence of one.
  const shown = limit === undefined ? entries : entries.slice(0, limit);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>sprout</TableHead>
          <TableHead>state</TableHead>
          <TableHead>kind</TableHead>
          {showPlant ? <TableHead>plant</TableHead> : null}
          {showBean ? <TableHead>about</TableHead> : null}
          <TableHead>date</TableHead>
          <TableHead>tags</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shown.map((e) => (
          <TableRow key={e.sprout.slug}>
            <TableCell>
              {/* The sprout's name goes to the sprout, not to its bean. A row
                  whose name linked to the parent was a fossil from before
                  `/admin/sprout/[slug]` existed, and it left the sprout page
                  reachable only from the palette and the bean's version list.
                  A sprout always has its own slug, so there is no case here
                  where the name is not a link — the about column still names
                  what it hangs from. */}
              <a
                href={`/admin/sprout/${encodeURIComponent(e.sprout.slug)}`}
                className="underline-offset-4 transition-colors hover:underline"
              >
                {resolveText(e.sprout.name)}
              </a>
            </TableCell>
            <TableCell>
              {/* The glyph, not a word — and the same map the sprout's own head
                  draws from, so the row and the page it links to cannot show
                  one state as two things. `stateOf` is what turns an absent
                  state into the value every other surface already reads it as,
                  rather than an em dash that says "no state" about a sprout
                  that has one by default. */}
              <SproutStateGlyph state={stateOf(e.sprout)} />
            </TableCell>
            <TableCell>
              {/* Same arrangement as the state: the glyph the sprout's kind
                  popover draws, carrying its word in the accessible name.
                  `kind` is required on a Sprout, so there is no absent case
                  for `stateOf`'s sibling to normalise. */}
              <SproutKindGlyph kind={e.sprout.kind} />
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
            {showBean ? (
              <TableCell className="text-muted-foreground">
                {(e.sprout.about ?? []).map((r) => r.slice(r.indexOf(":") + 1)).join(", ") || "—"}
              </TableCell>
            ) : null}
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
