import { BEAN_PREFIX, PLANT_PREFIX, POD_PREFIX, resolveText, type Dataset } from "./data";

export interface ResolvedEntity {
  ref: string;
  kind: "plant" | "pod" | "bean";
  href: string;
  name: string;
  description?: string;
}

export type EntityResolver = (ref: string) => ResolvedEntity | null;

// Pure. Turns a prefixed ref into what a card needs, or null.
//
// null is the whole security story: the caller passes the dataset it is allowed
// to show — filterPublic's projection on a public page, the full one in the
// admin — so a hidden target is simply absent, and a card over it renders
// nothing without any extra check. sprout: refs resolve to null too: sprouts
// have no public URL yet, and a card that cannot link anywhere is worse than no
// card (spec §4).
export function resolveEntity(dataset: Dataset, ref: string): ResolvedEntity | null {
  const found = ref.startsWith(PLANT_PREFIX)
    ? ({ kind: "plant", base: "/plant/", doc: dataset.getPlant(ref.slice(PLANT_PREFIX.length)) } as const)
    : ref.startsWith(POD_PREFIX)
      ? ({ kind: "pod", base: "/pod/", doc: dataset.getPod(ref.slice(POD_PREFIX.length)) } as const)
      : ref.startsWith(BEAN_PREFIX)
        ? ({ kind: "bean", base: "/bean/", doc: dataset.getBean(ref.slice(BEAN_PREFIX.length)) } as const)
        : null;
  if (!found?.doc) return null;

  const description = resolveText(found.doc.description ?? "").trim();
  return {
    ref,
    kind: found.kind,
    href: found.base + found.doc.slug,
    name: resolveText(found.doc.name),
    ...(description ? { description } : {}),
  };
}
