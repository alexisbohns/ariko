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
 * The frame itself stays in app/(public)/page.tsx: `relative aspect-[4/3]
 * w-full overflow-hidden rounded-lg bg-muted`. Its `relative` is only
 * belt-and-braces — the phone branch below establishes its own positioning
 * context, so the frame's copy is never actually needed. What lives here is
 * only what goes inside it. The `group` this component's hover hooks into is
 * NOT on that frame: it sits one level further out, on the anchor wrapping the
 * whole card, which is why the word can travel out of the frame and still be
 * driven by the same hover.
 *
 * The geometry is tied to the row's `w-56` card (224x168 frame). The phone
 * SPAN is half the frame wide — 112px — but `p-1` is inside that under
 * border-box, so the screenshot itself paints 104px, and at the 224x484
 * derivative's ratio that is 104 x 484/224 ~= 225px tall. Add the 4px of bezel
 * above it and the span is ~229px, which from `top-[58px]` runs ~119px past
 * the frame's bottom edge — so the frame reads as a window onto something
 * taller rather than as a cropped picture. Its bezel is drawn HERE rather than
 * baked into the stored file: baking it would make cloudinaryThumb crop a
 * composite instead of a screen, and turn "re-shoot that screen" into
 * "re-composite that screen".
 *
 * The phone itself is `components/phone-frame.tsx` since the gallery slice
 * needed the same one. What stayed here is what is the COVER's: where the phone
 * sits, how it rises on hover, and the word that leaves as it does.
 *
 * Three more numbers worth naming so they don't read as arbitrary: the frame
 * is 168px tall and the phone should show 110px of ITSELF at rest — the same
 * 110px the hover-transform comment below reckons its math from, of which the
 * top 4px is bezel, so 106px of screen — which is where `top-[58px]` comes
 * from: 168 - 110 = 58. The word above it is a `pt-[9px]` inset plus
 * `text-[34px]` leading-none text, a ~43px block, so 58 leaves it a clean
 * ~15px of headroom before the phone's bezel starts — without that gap the
 * word and the rising phone would overlap mid-transition rather than only
 * trading places at the end of it.
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
    <div className="relative h-full w-full">
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
          className={`absolute inset-x-0 top-0 z-10 pt-[9px] text-center font-display text-[34px] leading-none tracking-tight text-foreground ${GLIDE} group-hover:-translate-y-[110%]`}
        >
          {word}
        </span>
      ) : null}
      <PhoneFrame
        image={cover.image}
        // ~2.15x the box the screenshot actually paints — 104 x 225, once
        // `p-1` is taken out of the 112px span — rather than the flat 2x
        // lib/image-url.ts states every caller asks for. This is the one
        // caller that departs from that rule, and the departure is in the safe
        // direction: a little sharper than needed, never softer.
        //
        // The FULL height, not the ~110px visible at rest: hover reveals more
        // of the image, and a derivative sized to the rest state would blur
        // exactly when the visitor leans in.
        width={224}
        height={484}
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
        className={`absolute left-1/2 top-[58px] w-1/2 origin-top [transform:translateX(-50%)] ${GLIDE} group-hover:[transform:translateX(-50%)_translateY(-46px)_scale(0.8)]`}
      />
    </div>
  );
}
