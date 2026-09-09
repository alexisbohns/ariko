import type { Bean, MediaImage, Sprout, Text } from "./data";
import { coverFor } from "./cover";

/**
 * Pure. What a card should draw where a bean's cover goes — and, for a portrait
 * cover, that it is a PHONE rather than a picture.
 *
 * The whole opt-in rule lives in this file. `lib/cover.ts` is untouched: a bean
 * with no `cover` still shows the first image in its newest sprout carrying one.
 * What this adds is an override, and one branch off it.
 *
 * The rule that is easy to get wrong, and is pinned by a test: the phone
 * treatment is reachable ONLY through an explicit `bean.cover`. Deriving it
 * from portrait-ness alone reads well until a bean's newest sprout carries a
 * portrait photograph — a person, a poster, a book — and the landing page
 * silently draws a phone bezel around it. Setting the field is the author's
 * opt-in; the image's shape only decides how that opt-in is drawn.
 *
 * `keyword` being present is not the same as it having a word to show: a
 * bilingual `Text` can resolve to `""` for one reader's language while
 * carrying real text for the other's. This resolver is lang-agnostic by
 * design and cannot decide that — "wordless" is a state the consumer
 * completes after resolving the `Text`, not one this union guarantees.
 *
 * `beanCoverFor` below answers "what treatment". A surface that only wants to
 * know WHICH IMAGE — no phone branch, a fixed frame — calls `fillCoverFor`
 * instead, which honours the same `bean.cover` override and stops there.
 */
export type BeanCover =
  | { kind: "phone"; image: MediaImage; keyword?: Text }
  | { kind: "fill"; image: MediaImage };

/**
 * `width`/`height` are OPTIONAL on MediaImage. Cloudinary stores both on upload
 * (lib/storage.ts's toMediaImage), but a pasted third-party URL carries
 * neither, and lib/inbox.ts deliberately permits those. An image that cannot
 * prove it is portrait is not portrait — the safe failure here is "no phone",
 * never "no cover".
 */
function isPortrait(image: MediaImage): boolean {
  return (
    typeof image.width === "number" &&
    typeof image.height === "number" &&
    image.height > image.width
  );
}

export function beanCoverFor(bean: Bean, sprouts: Sprout[]): BeanCover | null {
  if (bean.cover) {
    if (!isPortrait(bean.cover)) return { kind: "fill", image: bean.cover };
    return bean.keyword === undefined
      ? { kind: "phone", image: bean.cover }
      : { kind: "phone", image: bean.cover, keyword: bean.keyword };
  }

  const derived = coverFor(sprouts);
  return derived ? { kind: "fill", image: derived } : null;
}

/**
 * Pure. WHICH IMAGE a bean's cover is — `bean.cover` when the author set one,
 * `coverFor`'s derivation otherwise, and null when there is neither.
 *
 * The sibling of `beanCoverFor`, and the split between them is the whole point
 * of having two: `beanCoverFor` answers "what TREATMENT", `fillCoverFor`
 * answers "which IMAGE". Surfaces that draw a cover in a fixed frame and have
 * no phone branch want only the second — today that is the public graph
 * payload (lib/graph.ts) alone, because a JSON node has no frame at all.
 *
 * The prose entity card was the other one, and stopped being: spec §8 excused
 * it from the phone because a phone cannot sit in a 720×128 letterbox, and the
 * card is no longer a letterbox — it is the landing row's 224×168 frame with
 * the name beside it (`components/entity-card.tsx`), so it asks `beanCoverFor`
 * like the landing page does. §8 excused these callers from the TREATMENT,
 * never from the OVERRIDE. Calling `coverFor` directly there — which both did
 * until this was written — makes `lib/data.ts`'s "explicit cover art, OVERRIDING the
 * derivation" true on the landing page and false everywhere else: an authored
 * bean shows its phone on the landing page while its card shows a different
 * image, or, in the field's own motivating case (cover art that does not live
 * inside a sprout's body), shows NOTHING.
 *
 * So this function must never grow a treatment. It returns a plain MediaImage
 * even for a portrait cover — the shape of the image is `beanCoverFor`'s
 * business, and a caller that wants to know is calling the wrong sibling.
 */
export function fillCoverFor(bean: Bean, sprouts: Sprout[]): MediaImage | null {
  return bean.cover ?? coverFor(sprouts);
}

/**
 * A pod has no cover of its own — it borrows the first one its beans can offer,
 * which is what `app/(public)/page.tsx` already did one level down.
 *
 * It borrows the ARTWORK and not the word. A pod showing a phone is right: it
 * is the same image, and the pod really does contain that app. A pod wearing
 * one of its beans' keywords is not — the word names the bean.
 *
 * The keyword is dropped by CONSTRUCTION rather than by assigning undefined, so
 * a deepEqual in the test sees a genuinely absent key.
 *
 * The two branches below look asymmetric — `phone` builds a new object, `fill`
 * returns `borrowed` by reference — because they are doing different jobs, not
 * by oversight: the clone exists solely to drop the keyword, and a `fill` cover
 * has no keyword to drop, so returning it unchanged is the correct behaviour,
 * not a shortcut.
 */
export function podCoverFrom(covers: (BeanCover | null)[]): BeanCover | null {
  const borrowed = covers.find((c): c is BeanCover => c !== null);
  if (!borrowed) return null;
  return borrowed.kind === "phone" ? { kind: "phone", image: borrowed.image } : borrowed;
}
