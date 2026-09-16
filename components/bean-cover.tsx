import type { BeanCover as BeanCoverValue } from "@/lib/bean-cover";
import type { Lang } from "@/lib/locale";
import { resolveText } from "@/lib/data";
import { cloudinaryThumb } from "@/lib/image-url";
import { PhoneFrame } from "@/components/phone-frame";

// One movement, two elements: the word leaving and the phone rising are the
// same gesture, so they share one duration and one curve by construction —
// tune the curve in one place and both halves of the choreography move
// together instead of silently drifting apart.
const GLIDE =
  "transition-transform duration-[420ms] ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none";

/**
 * The inside of a landing-page cover frame.
 *
 * SERVER-SAFE, and pinned as such in lib/server-safe-source.test.ts: no
 * "use client", no lucide-react. `app/(public)` has exactly one client island
 * (the TOC rail) and this is not it — every move below is CSS `group-hover` on
 * the anchor the card already wears, so a cover that animates costs the public
 * zone no JavaScript at all.
 *
 * It is server-ONLY, not merely server-safe: `resolveText` comes from
 * `@/lib/data`, which opens with `node:fs`. `server-safe-source.test.ts`'s
 * third assertion (no `node:` import in THIS file's own source) passes
 * textually, but the module graph behind it is not isomorphic — a future
 * client island (an admin Cover live-preview, say) that imports this component
 * would fail at build with a confusing bundler error rather than a clear one.
 * This is only ever meant to render on the server.
 *
 * The frame itself stays in components/bean-card.tsx: `relative aspect-[4/3]
 * w-full overflow-hidden rounded-lg bg-muted`. Its `relative` is only
 * belt-and-braces — the phone branch below establishes its own positioning
 * context, so the frame's copy is never actually needed. What lives here is
 * only what goes inside it. The `group` this component's hover hooks into is
 * NOT on that frame: it sits one level further out, on the anchor wrapping the
 * whole card, which is why the word can travel out of the frame and still be
 * driven by the same hover.
 *
 * The composition is expressed in container-query units against the frame
 * itself rather than in pixels against the row's card size, so it scales
 * with the card at ANY width — a full-bleed phone card and a third-of-a-column
 * desktop one both get the same proportions — and the numbers below do NOT
 * need revisiting the way a pixel value would. `@container` lives on this
 * component's OWN wrapper (the div that opens this branch), deliberately: the
 * file that depends on a container is the file that establishes one, so no
 * caller has to know to wrap it in one. A `cqw` with no container in scope
 * resolves against the VIEWPORT instead of the card — a silent,
 * size-dependent break rather than a build error, which is exactly why the
 * container isn't left for `bean-card.tsx` to supply.
 *
 * Each cqw value is stated as a fraction of the card's own width, and each
 * fraction is the one this file used to spell in pixels against a 224x168
 * frame. `top-[25.893cqw]` (on `PhoneFrame`) is 58/224, and 58 itself is
 * 168 - 110 — the frame's height minus the 110px the phone should show of
 * ITSELF at rest. `pt-[4.018cqw]` (the keyword span's inset) is 9/224 and
 * `text-[15.179cqw]` (its leading-none type size) is 34/224 — together a
 * ~43px block at a 224px card, leaving the same clean headroom above the
 * phone's bezel it always did, at any card width. `translateY(-20.536cqw)`
 * in the hover transform is 46/224. At a 224px card every one of these
 * resolves back to the exact old pixel value; at any other width it scales
 * with the card instead of silently drifting off the phone. Its bezel is
 * drawn HERE rather than baked into the stored file: baking it would make
 * cloudinaryThumb crop a composite instead of a screen, and turn "re-shoot
 * that screen" into "re-composite that screen".
 *
 * `components/phone-frame.tsx`'s own `p-1` bezel stays in pixels rather than
 * following suit: that file is shared with `components/screen-strip.tsx`,
 * which is NOT inside a container, so a cq unit there would resolve against
 * the viewport and silently break the strip. A 4px bezel at any card size is
 * acceptable and arguably correct.
 *
 * The phone itself is `components/phone-frame.tsx` since the gallery slice
 * needed the same one. What stayed here is what is the COVER's: where the phone
 * sits, how it rises on hover, and the word that leaves as it does.
 */
export function BeanCover({
  cover,
  lang,
}: {
  cover: BeanCoverValue | null;
  lang: Lang;
}) {
  if (!cover) return null;

  if (cover.kind === "fill") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        // Cloudinary shrinks it for us — 2x the 224px box, so the cover stays
        // sharp on a retina display without shipping the multi-megabyte
        // original. The derivative math is unchanged from what the page
        // rendered inline before this component existed.
        src={cloudinaryThumb(cover.image.url, { width: 448, height: 336 })}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
      />
    );
  }

  const word = resolveText(cover.keyword, lang).trim();

  return (
    // The phone branch's own positioning context. `group` and the frame's
    // shape stay the caller's — this div owns nothing but `relative`, so the
    // two absolutely-positioned children below can never end up positioned
    // against some ancestor further up the tree than intended.
    <div className="relative h-full w-full @container">
      {word ? (
        <span
          // aria-hidden: the bean's name sits two lines below this and the word
          // is a compressed restatement of it — the same reasoning that puts
          // alt="" on the image beside it.
          //
          // z-10 is load-bearing, not decorative: this span is emitted BEFORE
          // the phone in DOM order, so without it the rising phone would paint
          // OVER the departing word for the middle of the hover transition,
          // rather than the two visibly trading places.
          aria-hidden
          className={`absolute inset-x-0 top-0 z-10 pt-[4.018cqw] text-center font-display text-[15.179cqw] leading-none tracking-tight text-foreground ${GLIDE} group-hover:-translate-y-[110%]`}
        >
          {word}
        </span>
      ) : null}
      <PhoneFrame
        image={cover.image}
        // Decorative, always — never the image's own stored alt text. The
        // bean's name sits two lines below this card and the keyword above
        // is a compressed restatement of it, so the phone adds nothing an
        // assistive visitor doesn't already have, and alt="" is the correct
        // markup for that rather than a missing description. The same
        // reasoning is what puts aria-hidden on the keyword span above.
        alt=""
        // The card is fluid now, so this derivative is sized for the LARGEST
        // box it plausibly paints — a full-width phone card, where the
        // screenshot itself paints ~155px wide — rather than the smallest,
        // and is correspondingly more generous at desktop size where the
        // card shrinks back down. 336/224 = 1.5x, the same 484/224 ratio the
        // box has always used, rather than the flat 2x lib/image-url.ts
        // states every caller asks for. This is the one caller that departs
        // from that rule, and the departure is in the safe direction: a
        // little sharper than needed, never softer.
        //
        // The FULL height, not the ~110px visible at rest: hover reveals more
        // of the image, and a derivative sized to the rest state would blur
        // exactly when the visitor leans in.
        width={336}
        height={726}
        // The transform is written whole rather than composed from Tailwind's
        // translate-x / translate-y / scale utilities. Those set separate
        // custom properties that a hover variant then has to re-declare in full
        // anyway, and getting one of them wrong centres the phone off-axis for
        // the duration of the transition only — which is exactly the kind of
        // bug that survives review.
        //
        // -46px with a 0.80 scale from `origin-top`: 110px of the phone visible
        // at rest becomes ~156px of a smaller phone on hover. Against the
        // span's real ~229px that is 48% of it showing, becoming 85%.
        className={`absolute left-1/2 top-[25.893cqw] w-1/2 origin-top [transform:translateX(-50%)] ${GLIDE} group-hover:[transform:translateX(-50%)_translateY(-20.536cqw)_scale(0.8)]`}
      />
    </div>
  );
}
