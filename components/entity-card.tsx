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
 * What this file owns is the FRAME — 224×168, the landing card's box to the
 * pixel, because `components/bean-cover.tsx` derives its phone geometry from
 * exactly those numbers — and the fact that a card with art is a ROW: cover at
 * the left, name and description beside it. Without art it is the same stack of
 * text it always was.
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
      <div className="flex items-stretch">
        {/* The landing row's frame, verbatim (components/bean-card.tsx): the
            same 224×168 box, the same `overflow-hidden` that clips the
            departing word and crops the phone at the bottom, the same bare
            `bg-muted` underneath. `relative` is belt-and-braces — the phone
            branch establishes its own positioning context — and `shrink-0`
            is not: without it a long description squeezes the frame and the
            phone's geometry, which is reckoned in pixels, stops matching its
            box. The same frame shape is declared in `components/bean-card.tsx`,
            which differs only in its width and radius — change one and look
            at the other. */}
        <div className="relative aspect-[4/3] w-56 shrink-0 overflow-hidden bg-muted">
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
