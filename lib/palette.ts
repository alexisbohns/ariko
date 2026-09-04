import { GROUPS, groupPaletteItems, sectionItems, type PaletteItem, type PaletteKind } from "./palette-items";
import {
  BEAN_PREFIX,
  PLANT_PREFIX,
  POD_PREFIX,
  resolveText,
  type Bean,
  type Plant,
  type Pod,
  type RawGarden,
  type Seed,
} from "./data";

/**
 * The command palette's index (the ⌘K slice). Pure and JSX-free so `npm test`
 * reaches it: the palette itself is a client component, and the route handler
 * that serves this is three lines around `buildPaletteIndex`.
 *
 * Reads the RAW garden rather than a Dataset, for the reason lib/entity-options.ts
 * already gives: Dataset has no whole-bean accessor, and composing
 * beansForPlant + beansForPod + standaloneBeans to fake one would be three ways
 * to miss a bean. RawGarden carries sprouts too, so one read covers every kind.
 *
 * Everything crossing to the client is a plain string. Bilingual `Text` is
 * resolved HERE, which is what keeps the palette component free of any opinion
 * about language.
 *
 * The row type, the group order, the four sections and the grouping live in
 * lib/palette-items.ts instead, and are re-exported below. That is not tidiness:
 * this file imports lib/data.ts, which opens with `node:fs`, so it can never be
 * reached from the browser — and the palette component is a client component.
 */

export { GROUPS, groupPaletteItems, sectionItems };
export type { PaletteItem, PaletteKind };

const SEED_SNIPPET_MAX = 60;

function snippet(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > SEED_SNIPPET_MAX ? `${clean.slice(0, SEED_SNIPPET_MAX)}…` : clean;
}

/**
 * The display name of whatever contains `doc`, or undefined. Only the FIRST
 * parent is used: a row has one line for it, and `parents` is a containment
 * list whose head is the one an author would name.
 */
function parentLabel(
  parents: string[] | undefined,
  names: Map<string, string>,
): string | undefined {
  const ref = (parents ?? [])[0];
  if (!ref) return undefined;
  const name = names.get(ref);
  return name ? name : undefined;
}

export function buildPaletteIndex(input: { garden: RawGarden; seeds: Seed[] }): PaletteItem[] {
  const { garden, seeds } = input;

  // ref → display name, for the sublabels. Built over every tier first because
  // a bean's parent may be a pod or a plant, and a sprout's may be any of them.
  const names = new Map<string, string>();
  const index = (prefix: string, docs: Array<Plant | Pod | Bean> | undefined): void => {
    for (const doc of docs ?? []) names.set(prefix + doc.slug, resolveText(doc.name));
  };
  index(PLANT_PREFIX, garden.plants);
  index(POD_PREFIX, garden.pods);
  index(BEAN_PREFIX, garden.beans);

  // The same function the client calls before this index has loaded — one
  // definition of "the four sections", not two that must be kept in step.
  const items: PaletteItem[] = sectionItems();

  for (const plant of garden.plants ?? []) {
    items.push({
      id: PLANT_PREFIX + plant.slug,
      kind: "plant",
      label: resolveText(plant.name),
      href: `/admin/plant/${encodeURIComponent(plant.slug)}`,
      group: "Garden",
    });
  }

  for (const pod of garden.pods ?? []) {
    const sublabel = parentLabel(pod.parents, names);
    items.push({
      id: POD_PREFIX + pod.slug,
      kind: "pod",
      label: resolveText(pod.name),
      ...(sublabel ? { sublabel } : {}),
      href: `/admin/pod/${encodeURIComponent(pod.slug)}`,
      group: "Garden",
    });
  }

  for (const bean of garden.beans ?? []) {
    const sublabel = parentLabel(bean.parents, names);
    items.push({
      id: BEAN_PREFIX + bean.slug,
      kind: "bean",
      label: resolveText(bean.name),
      ...(sublabel ? { sublabel } : {}),
      // The route's param is spelled [id] but carries a slug — this is the
      // href app/admin/vault/page.tsx already links to.
      href: `/admin/bean/${encodeURIComponent(bean.slug)}`,
      group: "Vault",
    });
  }

  for (const sprout of garden.sprouts ?? []) {
    const sublabel = parentLabel(sprout.parents, names);
    items.push({
      id: `sprout:${sprout.slug}`,
      kind: "sprout",
      label: resolveText(sprout.name),
      ...(sublabel ? { sublabel } : {}),
      href: `/admin/sprout/${encodeURIComponent(sprout.slug)}`,
      group: "Vault",
    });
  }

  // Only the inbox. A promoted or discarded seed has no triage page worth
  // offering, and listSeeds already sorts newest-first — preserved here.
  for (const seed of seeds) {
    if (seed.status !== "inbox") continue;
    const note = snippet(seed.body?.en || seed.body?.fr || "");
    items.push({
      id: `seed:${seed.id}`,
      kind: "seed",
      label: resolveText(seed.title),
      ...(note ? { sublabel: note } : {}),
      href: `/admin/triage/${encodeURIComponent(seed.id)}`,
      group: "Inbox",
    });
  }

  return items;
}
