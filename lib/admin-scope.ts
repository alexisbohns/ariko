import { filterHref, type FilterValues } from "./admin-filters";
import { SCREEN_FILTER_KEYS } from "./screens";
import { SPROUT_KEYS } from "./sprouts";

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
 * Pure and JSX-free, so `npm test` reaches the rule rather than the chrome
 * that renders it.
 */

/** Filtering sections, and the dimensions each one admits. `filterHref` needs
 *  a NAMED key list — it is what keeps a hand-typed query key from surviving a
 *  click — so the scope control needs to know, per route, what that list is. */
export const scopeKeys: Record<string, readonly string[]> = {
  "/admin/inbox": ["plant"],
  "/admin/pods": ["plant"],
  "/admin/beans": ["plant", "pod"],
  "/admin/sprouts": SPROUT_KEYS,
  "/admin/screens": SCREEN_FILTER_KEYS,
};

const HUB_PREFIX = "/admin/plant/";
const ROOT = "/admin";

function normalize(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function hubHref(slug: string): string {
  return `${HUB_PREFIX}${encodeURIComponent(slug)}`;
}

/**
 * The scoped plant, or null.
 *
 * The hub's own slug wins over any `?plant=`, so the switcher never reads "All"
 * while the page under it is a plant, and a stray query on a hub URL cannot
 * make the chrome contradict the page.
 *
 * `String(...)` rather than a plain read for the reason `filterQuery` gives: a
 * REPEATED query key reaches a Next page as `string[]`, which this type does
 * not admit but a URL can always produce. An array stringifies to "a,b", which
 * is a slug no plant has — so the guard below turns it into no scope at all
 * rather than into a phantom one.
 */
export function resolveScope(pathname: string, active: FilterValues): string | null {
  const path = normalize(pathname);
  if (path.startsWith(HUB_PREFIX)) {
    const slug = path.slice(HUB_PREFIX.length);
    if (slug && !slug.includes("/")) return safeDecode(slug);
  }
  const raw = active.plant;
  if (Array.isArray(raw)) return null;
  const value = String(raw ?? "").trim();
  return value ? value : null;
}

function safeDecode(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    // A malformed escape is not a slug. Returning it raw keeps the chrome
    // showing something the garden will simply fail to resolve, which renders
    // as "All" — the same place every other unresolvable scope lands.
    return slug;
  }
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
  const path = normalize(pathname);
  const keys = scopeKeys[path];
  if (keys) return filterHref(path, active, keys, "plant", slug ?? "all");
  return slug ? hubHref(slug) : ROOT;
}
