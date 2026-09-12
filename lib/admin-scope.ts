import { filterHref, filterValue, type FilterValues } from "./admin-filters";
import { NAV_ITEMS, type ScopedId } from "./admin-nav";
import { hubHref, normalizePath, plantSlugFromPath, ROOT_PATH } from "./plant-path";
import { SECTION_KEYS } from "./section-keys";

/**
 * The admin's SUBJECT, and the one place that knows how to change it.
 *
 * The scope is a plant, and it lives in the URL — `?plant=` on a section, and
 * the slug itself on `/admin/plant/[slug]`. Not a cookie: `lib/admin-filters.ts`
 * exists to keep a filtered view shareable and filtering server-side, and the
 * scope is a filter with a better control, not a different kind of thing. Not a
 * path prefix: that is truer to Vercel and costs a duplicate page module per
 * section for the scoped and unscoped forms, to reach the same behaviour.
 *
 * The plant URL grammar itself — what `/admin/plant/<slug>` means, and how a
 * hub child route still names its plant — lives in `lib/plant-path.ts`, which
 * `lib/admin-nav.ts`'s `resolveNavItem` reads the same way, so the rail and
 * the scope cannot spell that address two different ways.
 *
 * Pure and JSX-free, so `npm test` reaches the rule rather than the chrome
 * that renders it — and CLIENT-SAFE, which is a stronger property and a newer
 * one. The plant switcher is an island and calls `scopeHref` directly, so
 * nothing in this file's import graph may reach `lib/data.ts`. That is why the
 * per-section key lists live in `lib/section-keys.ts` rather than in
 * `lib/sprouts.ts` and `lib/screens.ts` where they started: importing them
 * from there made this module import `node:fs` four hops down, and the chrome
 * failed to build. See that file for the whole account.
 */

/** Route href → filter dimensions, derived from `NAV_ITEMS` rather than
 *  re-typing paths — the move `resolveColumn` already makes in
 *  lib/admin-nav.ts, and the one the old route-keyed `scopeKeys` skipped. */
const ROUTE_KEYS: ReadonlyMap<string, readonly string[]> = new Map(
  NAV_ITEMS.flatMap((item) =>
    item.id in SECTION_KEYS ? [[item.href, SECTION_KEYS[item.id as ScopedId]] as const] : [],
  ),
);

/**
 * The filter dimensions a route admits, or `undefined` when it does not — a
 * hub page, or a route with no section of its own.
 *
 * Returns `undefined` on a miss rather than an empty array, and callers must
 * say so in their own type, because `tsconfig.json` sets `strict` but not
 * `noUncheckedIndexedAccess`: a bare `ROUTE_KEYS.get(...)` already types as
 * `readonly string[] | undefined`, but a plain object index signature would
 * not have, and `if (keys)` reads as a guard against something `tsc` would
 * silently believe never happens. A renamed path reaching that guard would
 * throw "keys is not iterable" inside `filterQuery` instead — the failure
 * class CLAUDE.md's rules section exists to catch, because it passes `tsc`,
 * `npm test` and `npm run build` right up until someone hits it live.
 */
export function scopeKeysFor(pathname: string): readonly string[] | undefined {
  return ROUTE_KEYS.get(pathname);
}

/**
 * The scoped plant, or null.
 *
 * The hub's own slug wins over any `?plant=`, so the switcher never reads "All"
 * while the page under it is a plant, and a stray query on a hub URL cannot
 * make the chrome contradict the page.
 *
 * `"all"` is the admin's sentinel for "no value", and it is read here through
 * `filterValue` rather than respelled — the one function every reader of a
 * filter URL now goes through, so a scope and a row filter cannot disagree
 * about what `?plant=all` means. Without it, a stale or hand-typed `?plant=all`
 * would come back as a scope literally named "all" while the rows below were
 * unfiltered: the exact "chrome contradicts the page" failure this function
 * exists to prevent.
 *
 * The `Array.isArray` guard returns before anything is stringified, which is
 * deliberately NOT `filterValue`'s behaviour for the same input. `filterValue`
 * keeps a repeated key's `String(...)` coercion — `"a,b"` — because that
 * still needs to match nothing rather than throw. This function has no such
 * constraint and returns `null` outright: a repeated `?plant=` cannot be a
 * scope in the first place, so there is no reason to manufacture one to reject.
 */
export function resolveScope(pathname: string, active: FilterValues): string | null {
  const slug = plantSlugFromPath(pathname);
  if (slug) return slug;
  const raw = active.plant;
  if (Array.isArray(raw)) return null;
  return filterValue(raw) ?? null;
}

/**
 * Where a switcher row points: stay on a filtering section and set the
 * dimension, or go to the plant's hub. `null` means All — which drops the key
 * on a section, and comes home to the root from anywhere else.
 */
export function scopeHref(
  pathname: string,
  active: FilterValues,
  slug: string | null,
): string {
  const path = normalizePath(pathname);
  const keys = scopeKeysFor(path);
  if (keys) return filterHref(path, active, keys, "plant", slug ?? "all");
  return slug ? hubHref(slug) : ROOT_PATH;
}
