import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The entity card, drawn once.
 *
 * There were two of these: `components/entity.tsx`, which renders a card in
 * published prose, and the tiptap node view in
 * `components/editor/entity-views.tsx`, which renders one while it is being
 * written. They had drifted in three ways at once — the editor's carried an
 * extra `py-4`, showed the entity's `ref`, and had no cover — so the author was
 * composing against a card the visitor would never see.
 *
 * Only ONE of those three differences was a real one. A `ref` is information in
 * the authoring zone and a leak outside it, exactly as `showUnresolved` is; the
 * other two were accidents. So `refText` is the one parameter the writing
 * surface passes, and the padding is now whatever `CardContent` says it is in
 * both places.
 *
 * The cover arrives as a SLOT rather than as an image, and that is what keeps
 * this file server-safe while the art it frames is not. The card used to draw
 * the cover itself — one `<img>` in a 720×128 letterbox — and a letterbox is
 * the one shape the landing page's cover treatment cannot live in: the phone
 * needs a frame it can rise inside of and run off the bottom of. Handing the
 * frame's CONTENTS in from outside is what lets the published card wear
 * `components/bean-cover.tsx` (server-only: it reaches `lib/data`, which opens
 * with `node:fs`) while this file is still imported by the editor's client node
 * view, which passes no slot at all.
 *
 * What this file owns is the FRAME: 224×168, the landing card's box, at `sm`
 * and up — and full-width below it, where the card stacks instead. Either way
 * the cover scales cleanly, because `components/bean-cover.tsx` expresses its
 * phone composition in container-query units against the frame's own size
 * rather than in pixels against those numbers.
 *
 * A card with art is a ROW at `sm` and up — cover at the left, name and
 * description beside it — and a COLUMN below it: a 224px cover beside text in
 * a 327px phone column leaves the text about a hundred pixels, so below `sm`
 * the cover moves to the top at full width instead. Without art it is the
 * same stack of text it always was, at every width.
 *
 * Server-safe, and used from a client node view — the same property
 * `components/chrome.tsx` and `components/plant-header.tsx` rest on.
 */

export function EntityCardBody({
  name,
  description,
  coverArt,
  refText,
  interactive,
}: {
  name: string;
  description?: string;
  /**
   * Beans only — what goes INSIDE the cover frame, composed by the caller.
   * `components/entity.tsx` passes `<BeanCover>`; the editor passes nothing and
   * gets the text-only card. Its absence is what switches the layout back to a
   * column, so there is never an empty frame beside a name.
   */
  coverArt?: ReactNode;
  /**
   * The prefixed ref (`bean:some-slug`), shown ONLY where a ref is information
   * rather than a leak: the editor, and the admin's read pages. Public prose
   * passes nothing.
   */
  refText?: string;
  /**
   * Whether this card is inside a link. Adds the hover affordance — and only
   * that, since the anchor itself belongs to the caller. A card in the editor
   * is not going anywhere, so it says so.
   */
  interactive?: boolean;
}) {
  const text = (
    <>
      <span
        className={
          "text-sm font-medium" +
          (interactive ? " underline-offset-4 group-hover:underline" : "")
        }
      >
        {name}
      </span>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {refText ? (
        <span className="font-heading text-[10px] text-muted-foreground">{refText}</span>
      ) : null}
    </>
  );

  if (!coverArt) {
    return (
      <Card className={interactive ? "transition-shadow group-hover:shadow-md" : undefined}>
        <CardContent className="flex flex-col gap-1">{text}</CardContent>
      </Card>
    );
  }

  return (
    // `py-0` because the cover is flush: the card's vertical padding would
    // otherwise inset the art from the top and bottom edges and leave two
    // stripes of card either side of it. The row's height is then the frame's
    // own, and the text pads itself back with the same `--card-spacing` the
    // card would have applied.
    <Card
      className={`py-0${interactive ? " transition-shadow group-hover:shadow-md" : ""}`}
    >
      <div className="flex flex-col items-stretch sm:flex-row">
        {/* The landing row's frame, verbatim (components/bean-card.tsx): the
            same 224×168 box at `sm` and up, the same `overflow-hidden` that
            clips the departing word and crops the phone at the bottom, the
            same bare `bg-muted` underneath. `relative` is belt-and-braces —
            the phone branch establishes its own positioning context.
            `shrink-0` is `sm:shrink-0` deliberately: in a column flex (below
            `sm`) it would constrain the vertical axis, which is not what it
            was ever for — the row is the only axis it needs to hold the
            frame against. `items-stretch` on the wrapper above stays
            unprefixed: it is what makes the cover fill the width when
            stacked. The same frame shape is declared in
            `components/bean-card.tsx`, which differs only in its width and
            radius — change one and look at the other. */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted sm:w-56 sm:shrink-0">
          {coverArt}
        </div>
        <CardContent className="flex min-w-0 flex-col justify-center gap-1 py-(--card-spacing)">
          {text}
        </CardContent>
      </div>
    </Card>
  );
}

/**
 * A reference that resolves to nothing, where saying so is the right thing.
 *
 * Never on a public page. `components/entity.tsx` renders this only behind
 * `showUnresolved`, because public prose must fail CLOSED — no stub, no name, no
 * gap to infer from (spec §2.3). In the admin and in the editor a dangling ref
 * is information.
 *
 * The dashed frame is the editor's old treatment, taken as the shared one over
 * the admin read page's bare `<p>`: a placeholder should read as a placeholder
 * rather than as a sentence someone wrote.
 */
export function UnresolvedRef({ refValue }: { refValue?: string }) {
  return (
    <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
      unresolved reference: {refValue || "(no ref)"}
    </p>
  );
}
