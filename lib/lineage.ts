import {
  BEAN_PREFIX,
  PLANT_PREFIX,
  POD_PREFIX,
  parentsWithPrefix,
  resolveText,
  type Bean,
  type Plant,
  type Pod,
} from "./data";
import { hubHref } from "./plant-path";
import type { Lang } from "./locale";

/**
 * Where an entity hangs from — the parenting chrome's model.
 *
 * Pure and JSX-free, beside `lib/admin-nav.ts` and for the same reason: the
 * component that consumes this is rendered, this is arithmetic, and arithmetic
 * is what `npm test` can reach without a database.
 *
 * THE GARDEN IS A PARAMETER, never loaded here. That keeps CLAUDE.md's garden
 * rule with the page — `loadRawGarden` in the admin, the cached reader in the
 * public zone — rather than letting one component decide a privacy question on
 * behalf of six pages. Same argument for `hrefs`: the two zones spell the same
 * entity's address differently, so the grammar arrives as a parameter and the
 * climb is shared.
 *
 * Dangling refs are DROPPED, exactly as `publishCascade` and `filterPublic`
 * drop them: a ref whose target is absent from the garden you were handed is a
 * ref you may not link to, and in the public zone that absence IS the privacy
 * projection.
 */

export interface LineageEntry {
  slug: string;
  name: string;
  href: string;
  /** Plants only — the mark the chrome draws instead of an icon. */
  logoUrl?: string;
}

export interface LineageTier {
  kind: "plant" | "pod" | "bean";
  entries: LineageEntry[];
}

/** Outermost first: plant, then pod, then bean. A tier with no entries is
 *  absent from the array — see the component for why empty is never drawn. */
export type Lineage = LineageTier[];

/** One zone's address grammar. */
export interface LineageHrefs {
  plant: (slug: string) => string;
  pod: (slug: string) => string;
  bean: (slug: string) => string;
}

export const ADMIN_HREFS: LineageHrefs = {
  // Through lib/plant-path.ts, so the plant address stays spelled once and this
  // module cannot disagree with the rail's resolver about what it means.
  plant: hubHref,
  pod: (slug) => `/admin/pod/${encodeURIComponent(slug)}`,
  bean: (slug) => `/admin/bean/${encodeURIComponent(slug)}`,
};

export const PUBLIC_HREFS: LineageHrefs = {
  plant: (slug) => `/plant/${encodeURIComponent(slug)}`,
  pod: (slug) => `/pod/${encodeURIComponent(slug)}`,
  bean: (slug) => `/bean/${encodeURIComponent(slug)}`,
};

/** The lookups the climb needs. Shaped like `RawGarden`'s first three fields so
 *  the admin can pass the garden it already has, and the public zone can build
 *  one from its `Dataset` (which has no `getBeans()` — and needs none, since a
 *  bean's own parents are pods and plants). */
export interface LineageGarden {
  plants?: Plant[];
  pods?: Pod[];
  beans?: Bean[];
}

export function resolveLineage(
  parents: string[] | undefined,
  garden: LineageGarden,
  opts: { lang: Lang; hrefs: LineageHrefs },
): Lineage {
  const { lang, hrefs } = opts;
  const plantBySlug = new Map((garden.plants ?? []).map((p) => [p.slug, p]));
  const podBySlug = new Map((garden.pods ?? []).map((p) => [p.slug, p]));
  const beanBySlug = new Map((garden.beans ?? []).map((b) => [b.slug, b]));

  // Insertion order is the answer's order, so a Set is both the dedup and the
  // "first ref wins" rule in one.
  const beanSlugs = new Set(parentsWithPrefix(parents, BEAN_PREFIX).filter((s) => beanBySlug.has(s)));
  const podSlugs = new Set(parentsWithPrefix(parents, POD_PREFIX).filter((s) => podBySlug.has(s)));
  const plantSlugs = new Set(parentsWithPrefix(parents, PLANT_PREFIX).filter((s) => plantBySlug.has(s)));

  for (const slug of beanSlugs) {
    const bean = beanBySlug.get(slug)!;
    for (const p of parentsWithPrefix(bean.parents, POD_PREFIX)) {
      if (podBySlug.has(p)) podSlugs.add(p);
    }
    for (const p of parentsWithPrefix(bean.parents, PLANT_PREFIX)) {
      if (plantBySlug.has(p)) plantSlugs.add(p);
    }
  }
  for (const slug of podSlugs) {
    for (const p of parentsWithPrefix(podBySlug.get(slug)!.parents, PLANT_PREFIX)) {
      if (plantBySlug.has(p)) plantSlugs.add(p);
    }
  }

  const tier = (
    kind: LineageTier["kind"],
    slugs: Set<string>,
    entry: (slug: string) => LineageEntry,
  ): LineageTier[] => (slugs.size ? [{ kind, entries: [...slugs].map(entry) }] : []);

  return [
    ...tier("plant", plantSlugs, (slug) => {
      const plant = plantBySlug.get(slug)!;
      const logoUrl = plant.logo?.url;
      return {
        slug,
        name: resolveText(plant.name, lang),
        href: hrefs.plant(slug),
        ...(logoUrl ? { logoUrl } : {}),
      };
    }),
    ...tier("pod", podSlugs, (slug) => ({
      slug,
      name: resolveText(podBySlug.get(slug)!.name, lang),
      href: hrefs.pod(slug),
    })),
    ...tier("bean", beanSlugs, (slug) => ({
      slug,
      name: resolveText(beanBySlug.get(slug)!.name, lang),
      href: hrefs.bean(slug),
    })),
  ];
}
