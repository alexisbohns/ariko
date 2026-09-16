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
 * What it owns is the FRAME, the text beneath it, and — as of `w-56` on the
 * anchor below — its own WIDTH. That is not this component's free choice to
 * make and it is not the caller's either: `components/bean-cover.tsx` reckons
 * the phone's rise in pixels off a 224x168 frame (`top-[58px]` is 168 - 110),
 * so 224px is a fixed consequence of that math, not a layout preference. A
 * caller that varied it would break only the VERTICAL half of the
 * composition — the phone's `w-1/2` and the frame's `aspect-[4/3]` scale with
 * the box, but the phone's absolute `top-[58px]` does not, so the rise would
 * land short of or past the frame's edge. That failure does not look broken,
 * it looks slightly wrong — which is worse, and is why the width is fixed
 * here rather than offered as a parameter and argued for in a paragraph.
 */
export function BeanCard({
  href,
  title,
  description,
  coverArt,
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
}) {
  return (
    <a href={href} className="group flex w-56 flex-col gap-3">
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
          <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>
        ) : null}
      </div>
    </a>
  );
}
