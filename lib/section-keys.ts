import type { ScopedId } from "./admin-nav";

/**
 * What each section filters BY — the five dimension lists, and nothing else.
 *
 * **This file exists to be client-safe.** The lists used to live beside the
 * code that consumed them, `SPROUT_KEYS` in `lib/sprouts.ts` and
 * `SCREEN_FILTER_KEYS` in `lib/screens.ts`, and `lib/admin-scope.ts` imported
 * both to build its map. That made the scope rule — a few lines of string
 * arithmetic with no runtime dependency of its own — transitively import
 * `lib/data.ts`, which opens with `node:fs`. The plant switcher is a client
 * component and needs `scopeHref`, so the chrome's first build failed with
 * `UnhandledSchemeError: Reading from "node:path"`, four modules downstream of
 * a constant that is three strings.
 *
 * It is the `lib/palette.ts` / `lib/palette-items.ts` split, for the same
 * reason and with the same shape: the half a client needs is a separate module
 * from the half that reaches the filesystem. CLAUDE.md names that pair as a
 * rule; this is the second time the boundary has bitten, which is why the file
 * is here rather than the constants being moved somewhere convenient.
 *
 * Separate from `lib/admin-nav.ts` deliberately, though it borrows that file's
 * `ScopedId`: which sections exist and what each one filters by are two facts,
 * and one module owning both would be a junk drawer by its third caller.
 *
 * Pure — no JSX, no `node:`, and nothing in its import graph that has either.
 * That property is load-bearing now and is what a future import here must not
 * break: a violation would pass `tsc` and `npm test`, and only `npm run build`
 * would catch it.
 */

/**
 * The sprouts section's dimensions. Named, rather than left anonymous in the
 * map below, because it has readers outside the scope rule: the section page
 * builds its filter bar's hrefs from it.
 */
export const SPROUT_KEYS = ["state", "plant", "tag"] as const;

/**
 * The screen library's dimensions, in the order they reach a URL. Named for
 * the same reason, and it has three readers beyond the page: `screensQuery`,
 * the hidden fields a write round-trips through (`filter-fields.tsx`), and the
 * action that reads them back.
 */
export const SCREEN_FILTER_KEYS = ["plant", "bean", "tag"] as const;

/**
 * Each scopable section's filter dimensions, keyed by `NavId` rather than by
 * route string. `ScopedId` — `lib/admin-nav.ts`'s "every id but Overview and
 * Beanstalk" — is what makes this a `Record` TypeScript checks exhaustively:
 * a new `NavId` fails to compile here until it is either given a key list or
 * added to `lib/admin-nav.ts`'s `UNSCOPED_IDS`. Keyed by route string, as this
 * map once was, a seventh section could compile while `navHref` (which decides
 * by excluding Overview and Beanstalk) and this map (which decided by including
 * a route) silently disagreed about it.
 *
 * The three unnamed lists have exactly one reader — `scopeKeysFor` — so they
 * are spelled here rather than exported as constants nothing would import.
 */
export const SECTION_KEYS: Readonly<Record<ScopedId, readonly string[]>> = {
  inbox: ["plant"],
  pods: ["plant"],
  beans: ["plant", "pod"],
  sprouts: SPROUT_KEYS,
  screens: SCREEN_FILTER_KEYS,
};
