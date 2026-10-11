import { BEAN_PREFIX, PLANT_PREFIX, POD_PREFIX, resolveText, type Dataset } from "./data";
import { DEFAULT_LANG, type Lang } from "./locale";
import { beanCoverFor, type BeanCover } from "./bean-cover";

export interface ResolvedEntity {
  ref: string;
  kind: "plant" | "pod" | "bean";
  href: string;
  name: string;
  description?: string;
  /**
   * Beans only: the bean's explicit `cover` when the author set one, otherwise
   * the derivation — the first image of the newest sprout that has one — AND
   * the treatment it should be drawn in (beanCoverFor, lib/bean-cover.ts).
   * Plants and pods have no media field at all (lib/data.ts), so this is
   * structurally absent for them, not merely unset.
   *
   * The TREATMENT, not just the image, since the prose card stopped being a
   * 720×128 letterbox: it is now the landing row's 224×168 frame with the name
   * beside it rather than under it, which is a shape the phone can live in. So
   * `fillCoverFor`'s reason for existing — spec §8's "a phone cannot sit in
   * that shape" — no longer applies here, and the card draws what the landing
   * page draws. `lib/graph.ts` is the remaining caller of the image-only
   * sibling: a JSON node has no frame at all.
   */
  cover?: BeanCover;
}

export type EntityResolver = (ref: string) => ResolvedEntity | null;

// Pure. Turns a prefixed ref into what a card needs, or null.
//
// null is the whole security story: the caller passes the dataset it is allowed
// to show — filterPublic's projection on a public page, the full one in the
// admin — so a hidden target is simply absent, and a card over it renders
// nothing without any extra check. sprout: refs resolve to null too — not yet,
// by decision. The address exists (`publicSproutHref` in lib/beanstalk.ts), but
// a sprout is a journal entry, and whether prose should embed one as a card is
// a product question the journal's public slice did not take. Until it is
// taken, an unresolved ref renders nothing, which is the honest default.
export function resolveEntity(
  dataset: Dataset,
  ref: string,
  lang: Lang = DEFAULT_LANG,
): ResolvedEntity | null {
  const found = ref.startsWith(PLANT_PREFIX)
    ? ({ kind: "plant", base: "/plant/", doc: dataset.getPlant(ref.slice(PLANT_PREFIX.length)) } as const)
    : ref.startsWith(POD_PREFIX)
      ? ({ kind: "pod", base: "/pod/", doc: dataset.getPod(ref.slice(POD_PREFIX.length)) } as const)
      : ref.startsWith(BEAN_PREFIX)
        ? ({ kind: "bean", base: "/bean/", doc: dataset.getBean(ref.slice(BEAN_PREFIX.length)) } as const)
        : null;
  if (!found?.doc) return null;

  const description = resolveText(found.doc.description ?? "", lang).trim();
  // sproutsForBean is already newest-first (buildDataset sorts with byDateDesc),
  // which is the ordering coverFor documents that it expects, and which
  // beanCoverFor passes straight through when it falls back to it.
  const cover =
    found.kind === "bean"
      ? beanCoverFor(found.doc, dataset.sproutsForBean(found.doc.slug))
      : null;
  return {
    ref,
    kind: found.kind,
    href: found.base + found.doc.slug,
    name: resolveText(found.doc.name, lang),
    ...(description ? { description } : {}),
    ...(cover ? { cover } : {}),
  };
}
