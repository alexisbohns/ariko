import type { Sprout, SproutState } from "./data";

/**
 * A sprout's state as a vocabulary — the sibling of `lib/plant-status.ts` and
 * `lib/plant-visibility.ts`, written when the sprout's head grew a state
 * control of its own.
 *
 * **This module is client-safe, and that is why it is a module.** The state
 * popover lives in `app/admin/_components/sprout-hero.tsx`, a client island.
 * `lib/sprouts.ts` — where this list used to live — imports `resolveText` as a
 * VALUE from `lib/data.ts`, which opens with `node:fs`, so importing the
 * vocabulary from there would fail `npm run build` with
 * `UnhandledSchemeError` four modules downstream of three strings. That is the
 * `lib/palette.ts` / `lib/palette-items.ts` split and then the
 * `lib/section-keys.ts` one; this is the third time the boundary has bitten
 * and the third time the fix is a client-safe module beside the server one.
 * Everything here is `import type`, which is erased at compile time.
 *
 * The WORDS are not here. `sproutStateLabel` lives in `lib/glyphs.ts`, which is
 * the one place a display form is decided for a value the admin draws — the
 * same split `lib/plant-visibility.ts` makes against `visibilityLabel`.
 */
export const SPROUT_STATES: readonly SproutState[] = ["draft", "private", "published"];

/**
 * The one place absence becomes a value, exactly as `statusOf` is for a plant's
 * status. `Sprout.state` is optional and `lib/data.ts` records the rule as
 * "absent => NOT published (safe default)"; `filterPublic` reads it as
 * `state === "published"`, so the safe default has a name, and the name is
 * `draft`.
 */
export function stateOf(sprout: Pick<Sprout, "state">): SproutState {
  return sprout.state ?? "draft";
}

export function isSproutState(raw: string): raw is SproutState {
  return (SPROUT_STATES as readonly string[]).includes(raw);
}
