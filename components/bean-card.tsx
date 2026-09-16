import type { ReactNode } from "react";

/**
 * The landing row's card face, drawn once.
 *
 * It had one caller and inline JSX in `app/(public)/page.tsx` until the related
 * rail wanted the same card at the end of a bean. Two drawings of one card is
 * the thing CLAUDE.md's shared-surfaces rule exists to stop, so it moved here
 * before it ever became two: one geometry, and what differs is a parameter.
 *
 * The cover arrives as a SLOT rather than as a cover value, exactly as
 * `components/entity-card.tsx` takes its `coverArt`, and for that file's
 * reason. `components/bean-cover.tsx` is server-ONLY — it reaches `lib/data`,
 * which opens with `node:fs` — so a card that drew the cover itself could never
 * be imported anywhere a card might one day be wanted. Handing the frame's
 * contents in from outside costs one prop and is what keeps THIS file
 * server-safe, which is what puts it in `lib/server-safe-source.test.ts`.
 *
 * This is not a variant of `components/entity-card.tsx` — it is a different
 * LAYOUT that happens to share a frame shape. The entity card is the PROSE
 * card: a row, frame at the left, name and description beside it. This is the
 * LANDING TILE: a stacked column, frame on top, text beneath.
 *
 * What it owns is the FRAME and the text beneath it. The WIDTH is the
 * caller's: this component fills whatever cell it is given rather than
 * declaring one, because the landing row is a horizontal scroller of fixed
 * 224px cells and the related rail is a grid that is one full-width column
 * on a phone and three on a desktop — two different widths for one card.
 * That is only safe because `components/bean-cover.tsx` expresses its phone
 * composition in container-query units against the frame's own size rather
 * than in pixels against a 224x168 frame, so it scales correctly with
 * whatever width the caller hands it. If that file ever reverted to
 * absolute pixels, this freedom would silently become a bug again.
 */
export function BeanCard({
  href,
  title,
  description,
  coverArt,
  clamp,
}: {
  href: string;
  title: string;
  /** One muted line, never markdown: descriptions are one-liners, content is
   *  not (spec §5). Blank renders nothing rather than an empty line. */
  description?: string;
  /** What goes INSIDE the cover frame, composed by the caller — `<BeanCover>`
   *  in both callers today. Absent renders the bare `bg-muted` frame, which is
   *  what a bean with no cover has always shown. */
  coverArt?: ReactNode;
  /**
   * Bound the description where the row WRAPS. The landing page's row is a
   * horizontal scroller — one line of cards, each standing alone, so a ragged
   * bottom is invisible there and the full description is worth showing. A
   * wrapping row is the opposite: the longest description in a row sets that
   * row's height and pushes the next row down past every short card in it, and
   * this garden's descriptions are 200-250 characters — 6 to 8 lines at this
   * width. Off by default, so the caller that does not wrap pays nothing.
   */
  clamp?: boolean;
}) {
  return (
    <a href={href} className="group flex flex-col gap-3">
      {/* `overflow-hidden` is what clips the departing word on its way
          out and crops the phone at the bottom; `relative` is
          belt-and-braces since the phone branch establishes its own
          positioning context. A null cover renders nothing here, so a
          bean or pod with no cover simply shows this bare `bg-muted`
          frame, like any other entry. The same frame shape is declared in
          `components/entity-card.tsx`, which differs only in its width and
          radius — change one and look at the other. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
        {coverArt}
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-heading text-sm tracking-tight underline-offset-4 group-hover:underline">
          {title}
        </span>
        {description?.trim() ? (
          <span
            className={
              "text-xs leading-relaxed text-muted-foreground" +
              (clamp ? " line-clamp-2" : "")
            }
          >
            {description}
          </span>
        ) : null}
      </div>
    </a>
  );
}
