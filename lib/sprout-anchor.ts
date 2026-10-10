/**
 * Where a sprout hangs — the write-side shape of spec 2026-10-10 §1.2. Exactly
 * one of the two: `about` refs (the plant is derived), or a plant (the
 * plant-level entry, `parents: ["plant:…"]` in storage). `updateSproutAnchor`
 * writes one and UNSETS the other, so a sprout never carries both.
 *
 * Server-only once `resolveAnchor` is here (it reaches `lib/data.ts` →
 * `node:fs`); client code may take `SproutAnchor` only via `import type`.
 */
import { BEAN_PREFIX, POD_PREFIX, resolveSproutPlants, type SproutGarden } from "./data";

export type SproutAnchor = { about: string[] } | { plant: string };

export type AnchorResult =
  | { ok: true; anchor: SproutAnchor; plantSlug: string }
  | { ok: false; error: string };

/**
 * The validator both write doors run before `updateSproutAnchor` or
 * `createSprout` (the sprout page's about panel and seed promotion). Every
 * ref must name a pod or a bean that exists, and all of them must roll up —
 * through `resolveSproutPlants`, the one derivation — to exactly one plant;
 * when the caller also states a plant, the two must agree. With no refs, the
 * stated plant IS the anchor, and it must exist. Each error ends in what to
 * do, because the author reading it is the one who has to do it.
 *
 * `resolveSproutPlants`, not a re-derivation: this module decides whether to
 * WRITE, and the read side decides what it MEANS, and the two must not drift.
 */
export function resolveAnchor(
  rawRefs: string[],
  plantSlug: string | null,
  garden: SproutGarden,
): AnchorResult {
  const refs = [...new Set(rawRefs.map((r) => r.trim()))];
  const plant = plantSlug?.trim() || null;

  if (refs.length === 0) {
    if (!plant) return { ok: false, error: "a sprout needs a plant, a pod or a bean" };
    if (!(garden.plants ?? []).some((p) => p.slug === plant)) return { ok: false, error: `unknown plant ${plant}` };
    return { ok: true, anchor: { plant }, plantSlug: plant };
  }

  const podSlugs = new Set((garden.pods ?? []).map((p) => p.slug));
  const beanSlugs = new Set((garden.beans ?? []).map((b) => b.slug));
  for (const ref of refs) {
    const isPod = ref.startsWith(POD_PREFIX);
    const isBean = ref.startsWith(BEAN_PREFIX);
    if (!isPod && !isBean) return { ok: false, error: `an about ref names a pod or a bean, not ${ref || "(blank)"}` };
    const slug = ref.slice(ref.indexOf(":") + 1);
    if (isPod ? !podSlugs.has(slug) : !beanSlugs.has(slug)) return { ok: false, error: `unknown ref ${ref}` };
  }

  const plants = resolveSproutPlants({ about: refs }, garden).map((p) => p.slug);
  if (plants.length === 0) {
    return { ok: false, error: "about refs roll up to no plant — root the pod or bean under a plant first" };
  }
  if (plants.length > 1) {
    return { ok: false, error: `about refs roll up to two plants (${plants.join(", ")}) — a sprout belongs to one` };
  }
  if (plant && plant !== plants[0]) {
    return { ok: false, error: `about refs roll up to ${plants[0]}, not the chosen plant ${plant}` };
  }
  return { ok: true, anchor: { about: refs }, plantSlug: plants[0] };
}
