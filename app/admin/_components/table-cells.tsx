import {
  EntityAvatar,
  EntityAvatarGlyph,
  type EntityMark,
} from "@/components/admin/glyphs";
import { TableCell } from "@/components/ui/table";

/**
 * The two cells the admin's tables genuinely repeat.
 *
 * They are here rather than in each table because they are the same thing
 * drawn on several surfaces — CLAUDE.md's rule — and they are the ONLY two
 * that qualify. Normalised for nouns, `pod-table.tsx` and `bean-table.tsx`
 * differ by about a dozen lines, which is a standing invitation to replace
 * both with one table driven by a column config. That would be worse: the
 * config would have to express a header word, an accessor, an alignment and a
 * renderer per column, and the tables it replaced would become data that no
 * longer reads as the markup it produces. What repeats is not the TABLE, it is
 * these two cells.
 *
 * So the extraction stops here, deliberately. Column order, which columns
 * exist at all, the header row and `showPlant` stay hand-written per table,
 * because those are exactly what makes a pod table a pod table.
 */

/**
 * A name over its slug, linked — the first column of every entity table.
 *
 * `avatar` is the one thing that varies: plants wear a mark beside the name
 * and the lower tiers do not. It is an `EntityMark` rather than a boolean so
 * the mark is built the same way wherever it appears, and absent rather than
 * derived from a logo URL, because a plant with no stored logo still draws the
 * initials fallback.
 */
export function EntityNameCell({
  href,
  name,
  slug,
  avatar,
}: {
  href: string;
  name: string;
  slug: string;
  avatar?: EntityMark;
}) {
  const stack = (
    <div className="flex flex-col leading-tight">
      <a href={href} className="underline-offset-4 hover:underline">
        {name}
      </a>
      <span className="font-heading text-xs text-muted-foreground">{slug}</span>
    </div>
  );
  return (
    <TableCell>
      {avatar ? (
        <div className="flex items-center gap-2.5">
          <EntityAvatar mark={avatar} />
          {stack}
        </div>
      ) : (
        stack
      )}
    </TableCell>
  );
}

/**
 * A mark AS a value, or the column's empty state.
 *
 * Absent is a real answer here and not a missing one: a pod with no plant, a
 * sprout whose bean is unrooted, a suggestion naming a plant the garden no
 * longer has. The em dash is what every other column in these tables spells
 * that with, and having it in one place is what keeps it from being spelled
 * two ways.
 */
export function MarkCell({ mark }: { mark?: EntityMark }) {
  return (
    <TableCell>
      {mark ? <EntityAvatarGlyph mark={mark} /> : <span className="text-muted-foreground">—</span>}
    </TableCell>
  );
}
