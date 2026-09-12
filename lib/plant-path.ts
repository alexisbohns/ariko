/**
 * The plant URL grammar — the one place `/admin/plant/<slug>` is spelled, so
 * the rail's resolver (`resolveNavItem`, lib/admin-nav.ts) and the scope rule
 * (`resolveScope`, lib/admin-scope.ts) read it from the same function instead
 * of each keeping its own idea of what the address means.
 *
 * Before this module existed the two disagreed on a hub CHILD route:
 * `resolveNavItem` truncated `/admin/plant/ariko/settings` to
 * `/admin/plant/ariko` so Overview keeps lighting once the hub grows
 * children, while `resolveScope` rejected any slug containing "/" and fell
 * through to `?plant=`. They agreed only because no hub child route existed
 * yet — the day one does, the rail lights Overview for "ariko" while the
 * switcher reads something else, a confident wrong answer rather than none.
 *
 * `pathname` is assumed URL-encoded throughout, the way `usePathname()`
 * hands it over — nothing here decodes a path before slicing it into
 * segments, only the segment it extracts.
 */

export const ROOT_PATH = "/admin";
const PLANT_PREFIX = "/admin/plant/";

/** Strips a trailing slash, except the root's own (`"/"`, length 1). Every
 *  function below normalizes its own input, so a caller never has to
 *  remember to. */
export function normalizePath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/** A plant's hub address, from a decoded slug. */
export function hubHref(slug: string): string {
  return `${PLANT_PREFIX}${encodeURIComponent(slug)}`;
}

/**
 * A plant's NARRATIVE address — the page that edits `plant.content`, and the
 * admin's first hub child route.
 *
 * Spelled here rather than at its three call sites (the hub's `edit →`, the
 * page's own back link, and `editContainerContentAction`'s redirect) for this
 * module's founding reason: the action's redirect is what an author lands on
 * after a save, and a builder that drifted from the one the hub links with
 * would send them somewhere the link never goes.
 *
 * Built on `hubHref`, so the slug is encoded exactly once and in one place.
 */
export function narrativeHref(slug: string): string {
  return `${hubHref(slug)}/narrative`;
}

/**
 * The plant a pathname names, decoded — or null when it names none. The
 * hub's own page and anything under it (`/admin/plant/ariko/anything`) both
 * resolve to `"ariko"`: truncating to the first segment is what lets a hub
 * child route exist without the rail losing Overview or the scope rule
 * losing the plant.
 *
 * A malformed escape (`%ZZ`) is not a slug, so this returns null rather than
 * the raw segment. A non-null return here becomes a SCOPE, and a scope
 * round-trips through `hubHref`, which would re-encode a raw "%" to "%25" —
 * silently pointing Overview at an address other than the page you are on.
 */
export function plantSlugFromPath(pathname: string): string | null {
  const path = normalizePath(pathname);
  if (!path.startsWith(PLANT_PREFIX)) return null;
  const segment = path.slice(PLANT_PREFIX.length).split("/")[0];
  if (!segment) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
