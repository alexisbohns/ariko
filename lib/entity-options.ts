import {
  BEAN_PREFIX,
  PLANT_PREFIX,
  POD_PREFIX,
  resolveText,
  type Bean,
  type Plant,
  type Pod,
  type RawGarden,
} from "./data";

export interface EntityOption {
  ref: string;
  kind: "plant" | "pod" | "bean";
  name: string;
  description?: string;
}

/**
 * Pure. The rows the editor's `@` and `/` menus offer (spec §2.6).
 *
 * Sprouts are absent by design: resolveEntity returns null for `sprout:` refs
 * because sprouts have no public URL, so offering one would mint a reference
 * that can never render. `exclude` keeps a page from referencing itself.
 *
 * Reads the RAW garden, not a Dataset — Dataset has no whole-bean accessor, and
 * composing beansForPlant + beansForPod + standaloneBeans to fake one would be
 * three ways to miss a bean.
 */
export function entityOptions(raw: RawGarden, exclude?: string): EntityOption[] {
  const rows: EntityOption[] = [];

  const collect = (
    kind: EntityOption["kind"],
    prefix: string,
    docs: Array<Plant | Pod | Bean> | undefined,
  ): void => {
    for (const doc of docs ?? []) {
      const ref = prefix + doc.slug;
      if (ref === exclude) continue;
      const description = resolveText(doc.description ?? "").trim();
      rows.push({
        ref,
        kind,
        name: resolveText(doc.name),
        ...(description ? { description } : {}),
      });
    }
  };

  collect("plant", PLANT_PREFIX, raw.plants);
  collect("pod", POD_PREFIX, raw.pods);
  collect("bean", BEAN_PREFIX, raw.beans);

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
