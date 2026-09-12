import { cloudinaryFit } from "@/lib/image-url";

export interface StripItem {
  slug: string;
  name: string;
  url: string;
  alt: string;
}

/**
 * The hub's screens, as thumbnails.
 *
 * PLAIN ANCHORS, not the library's tiles. Those tiles are this repo's only
 * `next/link`, deliberately confined to the four files of the interception
 * slice so that a click in the library opens the side sheet; importing them
 * here would spread the library past its boundary, and
 * `lib/screen-sheet-source.test.ts` exists to notice. A click from the hub is
 * an ordinary navigation into the library — which is right, because the hub is
 * not a place to edit screens.
 *
 * **There is a second `ScreenStrip`, and it is not this one.**
 * `components/screen-strip.tsx` is the PUBLIC plant page's exhibition — a
 * full-bleed rank of phone frames, one per EXHIBITED screen, each anchored to
 * the full Cloudinary image. This one is a fixed grid of four, over EVERY
 * screen the plant has, each anchored into the admin library. Different set,
 * different destination, different shape: the shared-surfaces rule asks that
 * two surfaces drawing the same thing draw it from one file, and these two
 * draw different things. Import by path, not by memory of the name.
 *
 * `alt` arrives from the caller rather than being derived here, and an empty
 * string is a legitimate value: the anchor around the image carries the
 * screen's name as its accessible name, so a screen with no stored alt text
 * still reaches a screen reader as a link that says what it opens, without
 * this component inventing a description of a picture it cannot see.
 */
export function ScreenStrip({ items }: { items: StripItem[] }) {
  return (
    <ul className="grid grid-cols-4 gap-3">
      {items.map((item) => (
        <li key={item.slug}>
          <a
            href={`/admin/screens/${encodeURIComponent(item.slug)}`}
            aria-label={item.name}
            className="block rounded-md transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {/* `object-contain` and a plain <img>, both for the contact
                sheet's reasons: a 9:19.5 capture cropped into a box is a
                picture of its middle third, and the URL is already a
                Cloudinary transform at the size it renders at. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cloudinaryFit(item.url, { width: 320 })}
              alt={item.alt}
              className="aspect-[3/4] w-full rounded-md object-contain"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
