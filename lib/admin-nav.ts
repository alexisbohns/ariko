import { filterHref } from "./admin-filters";
import { hubHref, normalizePath, plantSlugFromPath, ROOT_PATH } from "./plant-path";

/**
 * The admin rail's model. Pure and JSX-free so `npm test` can reach it: the
 * rail itself is a client component, and icons are bound to these ids there.
 *
 * The rail has a SUBJECT now (lib/admin-scope.ts). Two things follow, and both
 * are why `navItems` exists rather than a conditional in the component:
 *
 *  - scoped, the rail gains **Overview** — the plant's own page, the one item
 *    that cannot aggregate, since the all-plants overview IS the root;
 *  - scoped, it loses **Beanstalk** — it merges sprouts with pollen envelopes
 *    from sibling repos, and an envelope has no plant, so a filtered Beanstalk
 *    would answer half its own question and hide the other half.
 *
 * `id` rather than `href` is the key SECTION_ICONS uses, because Overview's
 * href is per-plant and an href-keyed map cannot hold an icon for it.
 *
 * "/admin" is no longer a section: it is the welcome page, reached by the mark
 * in the top-left cluster. That retires the exact-match special case this file
 * used to open with — the root now lights nothing, like any non-section.
 */

export type NavId =
  | "overview"
  | "inbox"
  | "pods"
  | "beans"
  | "sprouts"
  | "screens"
  | "beanstalk";

export interface NavItem {
  id: NavId;
  href: string;
  label: string;
  /**
   * The digit in this item's `Alt+<n>` shortcut, present on everything
   * `navItems` returns and absent from `NAV_ITEMS` itself.
   *
   * That asymmetry is the point: the number is a POSITION, not a property of
   * the section. Scoped, Overview takes the 1 and every section below it shifts
   * down — which is right, because the shortcut has to agree with what the rail
   * actually shows, and the rail changes shape with the scope. Storing it
   * beside `id` would freeze a number the composition is entitled to move.
   */
  hotkey?: HotkeyDigit;
}

/**
 * The shortcut digits, in order, and the ceiling on how many a rail can have.
 *
 * A closed union rather than `string`, because the consumer composes it into
 * `Alt+${digit}` and the hotkey library's own type is a template literal over
 * real key names — so a stray digit is a compile error at the call site rather
 * than a shortcut that silently never fires.
 *
 * Alt+0 is not a tenth shortcut. It is the key that would have to mean ten, and
 * no rail has ever been that long.
 */
export type HotkeyDigit = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

const HOTKEY_DIGITS: readonly HotkeyDigit[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Position → shortcut digit, for the first nine items and nothing after. */
function withHotkeys(items: readonly NavItem[]): readonly NavItem[] {
  return items.map((item, i) => {
    const hotkey = HOTKEY_DIGITS[i];
    return hotkey ? { ...item, hotkey } : item;
  });
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "inbox", href: "/admin/inbox", label: "Inbox" },
  { id: "pods", href: "/admin/pods", label: "Pods" },
  { id: "beans", href: "/admin/beans", label: "Beans" },
  { id: "sprouts", href: "/admin/sprouts", label: "Sprouts" },
  { id: "screens", href: "/admin/screens", label: "Screens" },
  { id: "beanstalk", href: "/admin/beanstalk", label: "Beanstalk" },
];

/** The two ids a scope never touches — Overview already IS the scope, and
 *  Beanstalk never admits one (see the docblock above). `ScopedId` and
 *  `navHref`'s runtime exemption both derive from this one array, which is
 *  what keeps them from being two hand-maintained copies that could drift in
 *  OPPOSITE directions on a seventh section — `navHref` deciding by
 *  exclusion, a per-section key map (lib/admin-scope.ts) deciding by
 *  inclusion. `lib/admin-scope.ts` imports `ScopedId` to key that map by id
 *  rather than by route string, so a new `NavId` fails `tsc` there until it
 *  is listed or excluded. */
const UNSCOPED_IDS = ["overview", "beanstalk"] as const;

/** Every id that CAN carry a plant scope. */
export type ScopedId = Exclude<NavId, (typeof UNSCOPED_IDS)[number]>;

/** The rail for a given scope. See the docblock for why it is a function. */
export function navItems(scope: string | null): readonly NavItem[] {
  if (!scope) return withHotkeys(NAV_ITEMS);
  return withHotkeys([
    { id: "overview", href: hubHref(scope), label: "Overview" },
    ...NAV_ITEMS.filter((item) => item.id !== "beanstalk"),
  ]);
}

/**
 * A rail item's href, carrying the scope through the one encoder every other
 * filtering control already uses (`lib/admin-filters.ts`'s `filterHref`) —
 * so `?plant=a+b` is spelled the same way here as it is in `scopeHref`
 * (lib/admin-scope.ts), rather than this file keeping its own
 * `encodeURIComponent` as a second, silently different builder for the same
 * query key. Delegating also means a `NavItem.href` that ever carried a query
 * of its own would gain `plant` correctly instead of a bare `?plant=` suffix
 * producing `?a=b?plant=s`.
 *
 * The exemption reads `UNSCOPED_IDS` rather than naming Overview and
 * Beanstalk again — see that array's docblock for why a second list here
 * would be the exact drift this function used to risk.
 */
export function navHref(item: NavItem, scope: string | null): string {
  if (!scope || (UNSCOPED_IDS as readonly NavId[]).includes(item.id)) return item.href;
  return filterHref(item.href, {}, ["plant"], "plant", scope);
}

// [route prefix, the nav href it lights]. Order is irrelevant, but for a
// narrower reason than "no string here is a prefix of another" — that reads
// false today: "/admin/pod" is a string-prefix of "/admin/pods", "/admin/bean"
// is a string-prefix of both "/admin/beans" and "/admin/beanstalk", and
// "/admin/sprout" is a string-prefix of "/admin/sprouts". The invariant that
// actually holds, and the one the boundary check below makes safe, is that no
// entry is a PATH prefix of another: no entry equals another, and no entry is
// another followed by "/". That is the one thing to check before adding a
// route here — a plain string prefix like the four above is fine.
const SECTIONS: ReadonlyArray<readonly [string, string]> = [
  ["/admin/inbox", "/admin/inbox"],
  ["/admin/triage", "/admin/inbox"],
  ["/admin/pods", "/admin/pods"],
  ["/admin/pod", "/admin/pods"],
  ["/admin/beans", "/admin/beans"],
  ["/admin/bean", "/admin/beans"],
  ["/admin/sprouts", "/admin/sprouts"],
  ["/admin/sprout", "/admin/sprouts"],
  ["/admin/screens", "/admin/screens"],
  ["/admin/beanstalk", "/admin/beanstalk"],
];

/**
 * The href of the nav item a pathname belongs to, or null when it belongs to
 * none (the welcome page, the login page, and anything unrecognized — an
 * unknown route lights nothing rather than guessing).
 *
 * A plant page resolves to its own two-segment address
 * (`/admin/plant/<slug>`), read through `lib/plant-path.ts` rather than
 * truncated here — which is how Overview lights: the rail's Overview href
 * for scope `s` is `/admin/plant/s`, and reading the grammar from the shared
 * module (rather than re-truncating the path locally) is what keeps this
 * agreeing with `resolveScope` on a hub child route.
 */
export function resolveNavItem(pathname: string): string | null {
  const path = normalizePath(pathname);
  const slug = plantSlugFromPath(path);
  if (slug) return hubHref(slug);
  for (const [prefix, href] of SECTIONS) {
    // The boundary check is what keeps "/admin/podsy" out of Pods.
    if (path === prefix || path.startsWith(`${prefix}/`)) return href;
  }
  return null;
}

/** Which measure a route reads in — see `components/page-column.tsx`. */
export type Column = "wide" | "reading";

/**
 * The admin's column, from its pathname.
 *
 * **A section index is wide, the welcome page is wide, everything else reads.**
 * The section indexes are exactly the NAV_ITEMS hrefs, so this reads NAV_ITEMS
 * rather than a parallel array that could drift from it. The root is spelled as
 * its own clause rather than pushed back into NAV_ITEMS, because it is not a
 * section — it is the page the sections hang off.
 *
 * An unrecognized route gets the reading column rather than the wide one.
 * Detail pages outnumber indexes and always will, and a document that renders
 * 80px too narrow is a smaller wrong than one that renders 280px too wide.
 *
 * THERE WAS A THIRD MEMBER, `"bare"`, answering `/admin/login` — the one route
 * with no chrome to clear. It is gone because the login page is no longer a
 * route this function can be asked about: `resolveColumn`'s only caller is
 * `AdminMain`, `AdminMain` is rendered only by `app/admin/(chrome)/layout.tsx`,
 * and the login page sits outside that group precisely so it never enters a
 * layout that reads the garden (`lib/admin-login-layout-source.test.ts` says
 * why that matters). A special case for a path the caller cannot receive is
 * dead code that reads like a live rule, and it is worth a paragraph because
 * it will look like an omission to whoever next greps for "login" here.
 */
export function resolveColumn(pathname: string): Column {
  const path = normalizePath(pathname);
  if (path === ROOT_PATH) return "wide";
  return NAV_ITEMS.some((item) => item.href === path) ? "wide" : "reading";
}
