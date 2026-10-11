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
 * Sprouts are absent, not yet, by decision: resolveEntity returns null for
 * `sprout:` refs, so offering one would mint a reference that renders nothing.
 * The address exists (`publicSproutHref` in lib/beanstalk.ts), but a sprout is
 * a journal entry, and whether prose should embed one as a card is a product
 * question the journal's public slice did not take. `exclude` keeps a page
 * from referencing itself.
 *
 * Reads the RAW garden, not a Dataset: every caller is an admin editor page
 * that already holds `loadRawGarden`'s unfiltered result, and the menus want
 * exactly its three container arrays — drafts and private entities included,
 * because in the authoring zone a reference to one should resolve. Building a
 * Dataset only to read those arrays back out would derive the timeline and the
 * journal indexes for nothing.
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
