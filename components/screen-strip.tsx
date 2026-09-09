import type { ExhibitionRow } from "@/lib/exhibition";
import { PhoneFrame } from "@/components/phone-frame";

/**
 * The plant's exhibition — a rank of phones the visitor swipes, with the
 * legends under them.
 *
 * SERVER-SAFE and pinned as such in lib/server-safe-source.test.ts: no
 * "use client", no lucide-react. It is also ISOMORPHIC rather than merely
 * server-safe, because it takes rows whose two `Text`s the page already
 * resolved — so nothing here reaches lib/data.ts and its `node:fs`.
 *
 * CSS only, which is the same decision components/media.tsx's Gallery made and
 * the primitive this reuses rather than reinvents: `overflow-x-auto` plus
 * scroll snapping. There is no carousel script, no dots and no arrows, so there
 * is nothing that stops working without JavaScript — the strip scrolls with a
 * finger, a trackpad, a scrollbar, or the arrow keys once it has focus.
 * `tabIndex={0}` is what makes that last one true.
 *
 * EVERY PHONE IS A REAL ANCHOR to the full Cloudinary image, and that is not
 * decoration: it costs this slice nothing (the URL is already on the page) and
 * it is the thing the lightbox slice intercepts. An island that adds behaviour
 * to a link that already works is an enhancement whose absence costs nothing;
 * one that supplies the only route to the image is a seventh exception of a
 * much more expensive kind.
 *
 * NOTHING IS CROPPED. Every phone shows the shot as it was taken, at its own
 * ratio — `PhoneFrame` without a `height`, which asks Cloudinary for `c_limit`
 * and closes the bezel on all four sides. The 3:4 window this strip used to
 * pin its phones into was one ratio imposed on captures from several devices,
 * so a taller screen lost its bottom third permanently; a rank of whole phones
 * of differing heights is the honest picture of an exhibition whose screens
 * differ. The anchor to the full image stays, for the reason above.
 *
 * FULL-BLEED, the landing row's rule (app/(public)/page.tsx): a horizontal
 * scroller must not be clipped at the text margin, which reads as a broken
 * layout rather than as a gallery. The plant page renders inside
 * READING_COLUMN, so the track breaks OUT of it — `w-screen` at
 * `left-1/2 -translate-x-1/2` — and the column's own 24px gutter is re-applied
 * as padding on the track's content, keeping the first phone flush with the
 * prose above it while the rest of the row runs to the edge and past it.
 * `overscroll-x-none` keeps a flick at the end of the row from reaching the
 * document (and the browser's back gesture).
 */
export function ScreenStrip({
  rows,
  plantName,
}: {
  rows: ExhibitionRow[];
  /** For the group's accessible name — the visitor hears whose screens these
   *  are, not "gallery". */
  plantName: string;
}) {
  // Nothing at all for an empty exhibition. Not an empty <section>: the plant
  // page's `gap-8` puts 32px on both sides of every flex item, so a wrapper
  // around nothing doubles the space above the narrative — the bug that page's
  // platform-links guard already documents.
  if (rows.length === 0) return null;

  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={`Screens from ${plantName}, ${rows.length}`}
      // pb-2 leaves room for the scrollbar rather than over the legends. The
      // focus ring rides on the track itself (which is not clipped by anything)
      // rather than on its content, so the -mx-1/px-1 Gallery needs is not
      // needed here.
      className="no-scrollbar not-prose relative left-1/2 w-screen -translate-x-1/2 overflow-x-auto overscroll-x-none pb-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <div className="flex w-max snap-x snap-mandatory items-start gap-4 px-6">
        {rows.map((row) => (
          <figure
            key={row.slug}
            className="flex w-[min(52vw,13rem)] shrink-0 snap-start flex-col gap-3"
          >
            <a
              // The FULL image, not a derivative. See the docblock.
              href={row.image.url}
              className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <PhoneFrame
                image={row.image}
                // The image's own stored alt text, not "" — here the screen
                // IS the content rather than decoration, so a description is
                // worth announcing. The figcaption beside it is a legend, not
                // a description (and most screens don't even have one — see
                // below), so it never makes this alt text redundant.
                alt={row.image.alt ?? ""}
                // 2x the ~200px of screen this paints. NO height: the shot
                // keeps its own ratio (see the docblock), and `c_limit` never
                // enlarges a capture narrower than this.
                width={400}
              />
            </a>

            {/* ALWAYS VISIBLE, never a hover state: a caption the visitor has to
              discover is a caption most visitors never read. The name is the
              fallback, because every screen has one and a legend is optional
              (lib/data.ts: "a hundred and seventy captions nobody asked for
              would be worse than none"). */}
            <figcaption className="font-heading text-xs leading-relaxed text-muted-foreground">
              {row.legend || row.name}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
