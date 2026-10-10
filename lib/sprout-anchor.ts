/**
 * Where a sprout hangs — the write-side shape of spec 2026-10-10 §1.2. Exactly
 * one of the two: `about` refs (the plant is derived), or a plant (the
 * plant-level entry, `parents: ["plant:…"]` in storage). `updateSproutAnchor`
 * writes one and UNSETS the other, so a sprout never carries both.
 */
export type SproutAnchor = { about: string[] } | { plant: string };
