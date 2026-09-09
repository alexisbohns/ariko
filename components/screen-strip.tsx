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
 * The window is `aspect-[3/4]` with `overflow-hidden` and the phone is pinned
 * to its top, so the phone runs off the bottom edge — the landing row's
 * treatment, and what makes the strip read as a rank of phones rather than a
 * row of cropped pictures.
 *
 * At a 208px row (`min(52vw,13rem)` maxed out) that window shows about 63% of
 * the phone, so roughly 37% of every screen is permanently hidden at rest —
 * and unlike the landing cover, nothing here has a hover state that reveals
 * more. That is the intended treatment, not an oversight, because the anchor
 * around each phone goes to the FULL image: the hidden part is one click
 * away with no script at all, which is the same fact that makes a future
 * lightbox an enhancement to that route rather than the only way to see the
 * rest of the screen.
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
      // -mx-1/px-1 so a focus ring on the strip is not clipped by its own
      // overflow; pb-2 leaves room for the scrollbar rather than over the
      // legends. Gallery's arrangement, for Gallery's reasons.
      className="not-prose -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2"
    >
      {rows.map((row) => (
        <figure key={row.slug} className="flex w-[min(52vw,13rem)] shrink-0 snap-start flex-col gap-3">
          <a
            // The FULL image, not a derivative. See the docblock.
            href={row.image.url}
            className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {/* The window. `relative` establishes the positioning context the
                phone is pinned into, and `overflow-hidden` is what crops it. */}
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl">
              <PhoneFrame
                image={row.image}
                // The image's own stored alt text, not "" — here the screen
                // IS the content rather than decoration, so a description is
                // worth announcing. The figcaption beside it is a legend, not
                // a description (and most screens don't even have one — see
                // below), so it never makes this alt text redundant.
                alt={row.image.alt ?? ""}
                // 2x the ~200px of screen this paints, at a 9:19.5 phone's
                // ratio, and the FULL height rather than the ~75% the window
                // shows: the strip is one place a visitor may zoom, and a
                // derivative sized to the visible part would blur there.
                width={400}
                height={868}
                className="absolute inset-x-0 top-0"
              />
            </div>
          </a>

          {/* ALWAYS VISIBLE, never a hover state: a caption the visitor has to
              discover is a caption most visitors never read. The name is the
              fallback, because every screen has one and a legend is optional
              (lib/data.ts: "a hundred and seventy captions nobody asked for
              would be worse than none"). */}
          <figcaption className="text-xs leading-relaxed text-muted-foreground">
            {row.legend || row.name}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
