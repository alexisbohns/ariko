import type { ReactNode } from "react";

/**
 * An icon that links somewhere and says its name on hover — with NO client JS.
 *
 * CLAUDE.md says never hand-roll a primitive the registry already has, and the
 * registry has `tooltip`. It is @base-ui/react's, and it is "use client":
 * using it here would make the public zone's NAVIGATION script-dependent in
 * order to gain a hover label. That is the one trade the zone cannot make — a
 * visitor who cannot navigate has lost the site.
 *
 * So the label is CSS. This is a deviation worth naming rather than hiding, and
 * it is the good direction of it:
 *
 *  - The accessible name is the anchor's `aria-label`, never the visual span
 *    (which is aria-hidden). What a screen reader announces does not depend on
 *    the hover affordance existing at all.
 *  - It WORKS with script off, which the registry component does not. Hand-
 *    rolling is right exactly when the hand-rolled thing is more capable in the
 *    circumstances it is used in.
 *  - It is a label on hover, not a tooltip PRIMITIVE: no portal, no positioning
 *    engine, no focus management, no delay groups. Nothing the registry
 *    component earns its complexity for is needed by three fixed icons in a
 *    corner.
 *
 * The admin keeps the real Tooltip. This component is public-zone only.
 *
 * `group-focus-visible` as well as `group-hover`: a keyboard user tabbing the
 * rail gets the same label a pointer does.
 */
export function IconLink({
  href,
  label,
  children,
}: {
  href: string;
  /** The accessible name AND the visible label — one string, so they cannot drift. */
  label: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className="group/icon relative flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 font-heading text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover/icon:opacity-100 group-focus-visible/icon:opacity-100"
      >
        {label}
      </span>
    </a>
  );
}
