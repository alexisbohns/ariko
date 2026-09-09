import type { MediaImage } from "@/lib/data";
import { cloudinaryThumb } from "@/lib/image-url";

/**
 * A phone, drawn around a portrait screenshot.
 *
 * SERVER-SAFE and pinned as such in lib/server-safe-source.test.ts, and unlike
 * `components/bean-cover.tsx` it is genuinely ISOMORPHIC: it imports a TYPE
 * from lib/data and a pure string function from lib/image-url, and no value
 * that reaches `node:fs`.
 *
 * Extracted when the screen gallery needed the cover's phone. What lives here
 * is the phone and nothing else — the bezel, the screen's radius, and the
 * derivative. What does NOT live here is where a phone sits, how it moves, or
 * what is written above it: `bean-cover.tsx` keeps its own positioning and its
 * hover choreography, `screen-strip.tsx` keeps its window, and neither has to
 * know the other exists.
 *
 * Two details are load-bearing rather than styling:
 *
 *  - **`bg-neutral-900`, not a theme token.** A phone is dark in both themes,
 *    so `bg-foreground` (near-white in dark mode) or `bg-card` (vanishes into
 *    the page) would both be silently wrong fixes for something that was never
 *    broken. It is the one non-token colour in either caller.
 *  - **The bezel is drawn HERE, never baked into the stored file.** Baking it
 *    would make cloudinaryThumb crop a composite instead of a screen, and turn
 *    "re-shoot that screen" into "re-composite that screen".
 *
 * `pb-0` is what makes the phone bottomless: it has a bezel on three sides and
 * runs off the bottom of whatever frames it, which is what lets both callers
 * read as a window onto something taller rather than as a cropped picture.
 *
 * `width`/`height` are the DERIVATIVE's, not the box's — every caller asks
 * Cloudinary for roughly twice the pixels it paints, so the screen stays sharp
 * on a retina display, and asks for the FULL height rather than the visible
 * part, because both callers reveal more of the image than they show at rest.
 */
export function PhoneFrame({
  image,
  width,
  height,
  className,
}: {
  image: MediaImage;
  width: number;
  height: number;
  /** Where the phone sits and how it moves — the caller's business entirely. */
  className?: string;
}) {
  return (
    <span className={`rounded-2xl bg-neutral-900 p-1 pb-0 shadow-lg ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cloudinaryThumb(image.url, { width, height })}
        alt={image.alt ?? ""}
        loading="lazy"
        decoding="async"
        className="block w-full rounded-t-xl"
      />
    </span>
  );
}
