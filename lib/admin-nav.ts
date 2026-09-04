/**
 * The admin rail's model. Pure and JSX-free so `npm test` can reach it: the
 * rail itself is a client component, and icons are bound to these hrefs there.
 *
 * The floating rail dropped the `current` prop every page used to pass, so the
 * active item is inferred from the pathname instead. Two things make that
 * non-obvious, and both are why this function exists rather than an inline
 * `startsWith`:
 *
 *  - "/admin" is a prefix of every admin URL, so it can only ever match
 *    EXACTLY, or the Inbox icon would light on every page.
 *  - the detail routes do not share their section's name — a sprout and a bean
 *    belong to the Vault, a plant and a pod to the Garden, a triage to the
 *    Inbox.
 */

export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Inbox" },
  { href: "/admin/vault", label: "Vault" },
  { href: "/admin/garden", label: "Garden" },
  { href: "/admin/beanstalk", label: "Beanstalk" },
];

// [route prefix, the nav href it lights]. Order is irrelevant — no prefix here
// is a prefix of another.
const SECTIONS: ReadonlyArray<readonly [string, string]> = [
  ["/admin/vault", "/admin/vault"],
  ["/admin/sprout", "/admin/vault"],
  ["/admin/bean", "/admin/vault"],
  ["/admin/garden", "/admin/garden"],
  ["/admin/plant", "/admin/garden"],
  ["/admin/pod", "/admin/garden"],
  ["/admin/beanstalk", "/admin/beanstalk"],
  ["/admin/triage", "/admin"],
];

/**
 * The href of the nav item a pathname belongs to, or null when it belongs to
 * none (the login page, and anything unrecognized — an unknown route lights
 * nothing rather than guessing).
 */
export function resolveNavItem(pathname: string): string | null {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (path === "/admin") return "/admin";
  for (const [prefix, href] of SECTIONS) {
    // The boundary check is what keeps "/admin/vaulted" out of the Vault.
    if (path === prefix || path.startsWith(`${prefix}/`)) return href;
  }
  return null;
}
