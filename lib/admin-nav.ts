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
}

export const NAV_ITEMS: NavItem[] = [
  { id: "inbox", href: "/admin/inbox", label: "Inbox" },
  { id: "pods", href: "/admin/pods", label: "Pods" },
  { id: "beans", href: "/admin/beans", label: "Beans" },
  { id: "sprouts", href: "/admin/sprouts", label: "Sprouts" },
  { id: "screens", href: "/admin/screens", label: "Screens" },
  { id: "beanstalk", href: "/admin/beanstalk", label: "Beanstalk" },
];

/** The rail for a given scope. See the docblock for why it is a function. */
export function navItems(scope: string | null): NavItem[] {
  if (!scope) return NAV_ITEMS;
  return [
    {
      id: "overview",
      href: `/admin/plant/${encodeURIComponent(scope)}`,
      label: "Overview",
    },
    ...NAV_ITEMS.filter((item) => item.id !== "beanstalk"),
  ];
}

/**
 * A rail item's href, carrying the scope. Overview already IS the scope, so it
 * is left alone — appending ?plant= to a plant's own page would be a second
 * spelling of the same fact, and `resolveScope` would then have two sources to
 * disagree about.
 */
export function navHref(item: NavItem, scope: string | null): string {
  if (!scope || item.id === "overview") return item.href;
  return `${item.href}?plant=${encodeURIComponent(scope)}`;
}

// [route prefix, the nav href it lights]. Order is irrelevant — no prefix here
// is a prefix of another, and the boundary check below is what keeps that true
// as routes are added.
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
 * A plant page resolves to ITSELF, which is how Overview lights: the rail's
 * Overview href for scope `s` is `/admin/plant/s`, and that is the pathname.
 */
export function resolveNavItem(pathname: string): string | null {
  const path = normalize(pathname);
  if (path.startsWith(PLANT_PREFIX_PATH)) return path;
  for (const [prefix, href] of SECTIONS) {
    // The boundary check is what keeps "/admin/podsy" out of Pods.
    if (path === prefix || path.startsWith(`${prefix}/`)) return href;
  }
  return null;
}

function normalize(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/** Which measure a route reads in — see `components/page-column.tsx`. */
export type Column = "bare" | "wide" | "reading";

/**
 * The admin's column, from its pathname.
 *
 * **A section index is wide, the welcome page is wide, everything else reads,
 * and login is bare.** The section indexes are exactly the NAV_ITEMS hrefs, so
 * this reads NAV_ITEMS rather than a parallel array that could drift from it.
 * The root is spelled as its own clause rather than pushed back into NAV_ITEMS,
 * because it is not a section — it is the page the sections hang off.
 *
 * An unrecognized route gets the reading column rather than the wide one.
 * Detail pages outnumber indexes and always will, and a document that renders
 * 80px too narrow is a smaller wrong than one that renders 280px too wide.
 */
export function resolveColumn(pathname: string): Column {
  const path = normalize(pathname);
  if (path === LOGIN_PATH) return "bare";
  if (path === ROOT_PATH) return "wide";
  return NAV_ITEMS.some((item) => item.href === path) ? "wide" : "reading";
}

const LOGIN_PATH = "/admin/login";
const ROOT_PATH = "/admin";
const PLANT_PREFIX_PATH = "/admin/plant/";
