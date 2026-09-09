import type { MediaImage } from "@/lib/data";
import { cloudinaryFit, cloudinaryThumb } from "@/lib/image-url";

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
 * Three details are load-bearing rather than styling:
 *
 *  - **`bg-neutral-900`, not a theme token.** A phone is dark in both themes,
 *    so `bg-foreground` (near-white in dark mode) or `bg-card` (vanishes into
 *    the page) would both be silently wrong fixes for something that was never
 *    broken. It is the one non-token colour in either caller.
 *  - **The bezel is drawn HERE, never baked into the stored file.** Baking it
 *    would make cloudinaryThumb crop a composite instead of a screen, and turn
 *    "re-shoot that screen" into "re-composite that screen".
 *  - **`alt` is REQUIRED, and it is the CALLER's answer, never this file's.**
 *    "Is this image decorative?" is a question about the context a phone
 *    appears in, not about the phone itself, and the two callers answer it
 *    oppositely: `bean-cover.tsx` passes `alt=""` because the bean's name
 *    sits two lines below the card and the keyword above is a compressed
 *    restatement of it, so its phone is decorative; `screen-strip.tsx` passes
 *    the image's own stored alt text, because there the screen IS the content
 *    and the legend beside it is a caption, not a description, so it does not
 *    make the image redundant. A shared default — `image.alt ?? ""`, which is
 *    what this file briefly did — would have picked the strip's answer for
 *    both callers, silently: it changed the cover's accessible name for any
 *    bean whose cover happened to carry stored alt text, and no test caught
 *    it, because the cover's own fixture never set `alt`. Requiring the prop
 *    is what makes the next caller state its own answer instead of inheriting
 *    one that only happened to be right for the first.
 *
 * `height` IS THE SWITCH between the phone's two shapes, and the two halves of
 * it always travel together:
 *
 *  - **Given** — the caller frames the phone in a box of its own and wants it
 *    cropped INTO that box (`c_fill`). The phone is then BOTTOMLESS: `pb-0`
 *    gives it a bezel on three sides so it runs off the bottom of whatever
 *    frames it, reading as a window onto something taller rather than as a
 *    cropped picture. `bean-cover.tsx`'s case.
 *  - **Omitted** — the caller wants the SCREEN AS SHOT, whatever its ratio
 *    (`c_limit`, which also never enlarges). Cropping is then the one thing
 *    that must not happen, so there is no box to run off: the bezel closes on
 *    all four sides and the phone is as tall as the image is. `screen-strip.tsx`'s
 *    case — a rank of phones whose screens are different devices' captures, and
 *    a shared 3:4 window turned each of them into somebody's middle third.
 *
 * `block` on the wrapper is load-bearing, not tidiness: it is a `<span>` (so it
 * can sit inside an anchor's phrasing content), and an INLINE box shrink-wraps
 * to the line rather than to the image it padded — the bezel collapses to a
 * dark tick beside the screen. It was invisible while every caller pinned the
 * phone with `absolute`, which blockifies it; the first caller that stopped
 * (the strip, once it kept the shot's own ratio) lost the bezel entirely.
 *
 * `width` (and `height` when it is given) are the DERIVATIVE's, not the box's —
 * every caller asks Cloudinary for roughly twice the pixels it paints, so the
 * screen stays sharp on a retina display.
 */
export function PhoneFrame({
  image,
  alt,
  width,
  height,
  className,
}: {
  image: MediaImage;
  /** Decorative or content — the caller's call, never this file's. See the
   *  docblock. */
  alt: string;
  width: number;
  /** Omit to keep the shot's own ratio, uncropped and bezelled all round. See
   *  the docblock: this prop is the switch between the phone's two shapes. */
  height?: number;
  /** Where the phone sits and how it moves — the caller's business entirely. */
  className?: string;
}) {
  const bottomless = height !== undefined;
  return (
    <span
      className={`block rounded-2xl bg-neutral-900 shadow-lg ${
        bottomless ? "p-1 pb-0" : "p-1"
      } ${className ?? ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={
          height === undefined
            ? cloudinaryFit(image.url, { width })
            : cloudinaryThumb(image.url, { width, height })
        }
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`block w-full ${bottomless ? "rounded-t-xl" : "rounded-xl"}`}
      />
    </span>
  );
}
