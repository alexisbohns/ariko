import type { ReactNode } from "react";

import { CHROME_PLATE } from "./chrome-plate";
import { Kbd } from "./ui/kbd";
import { magnetLabelSide, magnetPosition, type Magnet } from "@/lib/chrome-magnet";
import { cn } from "@/lib/utils";

/**
 * The floating chrome, for both zones.
 *
 * Every chrome cluster in Ariko is the same object: a plated container pinned to
 * an edge of the viewport, holding ghost icon-buttons that say their name on
 * hover. There were five of them and five implementations —
 * `app/admin/_components/admin-chrome.tsx` (the rail and the account cluster),
 * `app/admin/_components/plant-rail.tsx` (the plant's Exhibition rail),
 * `app/(public)/_components/public-chrome.tsx` (the nav and the language pill).
 * `components/chrome-plate.ts` had already made the case for sharing their
 * PAINT; this is the same case, carried to their geometry and their behaviour.
 *
 * **This file is server-safe, and that is load-bearing rather than incidental.**
 * No `"use client"`, and no `lucide-react` — which routes every icon through an
 * `Icon.mjs` carrying `"use client"`, so a single import here would drag the
 * public zone's navigation across a client boundary. `lib/chrome-source.test.ts`
 * enforces both, because `tsc`, `npm test` and `npm run build` would all pass a
 * violation and the first person to notice would be a visitor with script off.
 *
 * Being server-safe is also what lets the admin's client islands import it: a
 * module with no `"use client"` and no server-only import renders in either
 * tree. One file, five clusters, two zones.
 *
 * **The hover label is CSS, not the registry's Tooltip.** That deviates from
 * CLAUDE.md's "never hand-roll a primitive the registry has", and it is the good
 * direction of the trade — `components/icon-link.tsx`, which this file
 * generalises and replaces, argued the public half: `Tooltip` is `"use client"`,
 * and using it here would make NAVIGATION script-dependent in order to gain a
 * hover label. The admin half is `lib/chrome-magnet.ts`'s argument: a cluster
 * pinned to a viewport corner has nothing to collide with, so the positioning
 * engine the registry brings has no work to do. Every popover, sheet and the
 * palette keep the real primitives.
 *
 * The known cost, moved here from `icon-link.tsx` because it now applies to the
 * admin rail too: there is no delay group, so a pointer crossing a cluster
 * flashes each label in turn rather than opening one and holding it. Acceptable
 * for three or four fixed icons in a corner; it would not be for a dense
 * toolbar.
 */

/**
 * A cluster.
 *
 * `label` decides the element: a nav gets `<nav aria-label>`, and everything
 * else gets a plain `<div>`. The account cluster is not a nav and never was —
 * it is a log-out form and two actions — so giving it a landmark would put a
 * second "navigation" in the page's landmark list that navigates nowhere.
 *
 * `data-side` is how the label side reaches the labels. The alternative was
 * threading a prop through every item or a React context, and a context would
 * have cost the file its `"use client"`-free status — the one property that
 * lets the public zone use it at all.
 */
export function Chrome({
  magnet,
  orientation = "horizontal",
  label,
  content,
  hotkeysVisible,
  className,
  children,
}: {
  magnet: Magnet;
  orientation?: "horizontal" | "vertical";
  /** When present, the cluster is a `<nav>` with this accessible name. */
  label?: string;
  /**
   * Reveal every item's label and shortcut at once, as holding Alt does.
   *
   * A BOOLEAN PROP RATHER THAN A KEY LISTENER, because this file is server-safe
   * and a listener would need `"use client"` — the one property that lets the
   * public zone use it at all. Whoever holds the key state passes the flag;
   * today that is `app/admin/_components/admin-chrome.tsx`, and the public
   * zone, which has no shortcuts, passes nothing and pays nothing.
   */
  hotkeysVisible?: boolean;
  /**
   * A cluster of TEXT rather than icons — the language switch is the only one.
   * Its own radius and padding, as a named variant rather than a `className`
   * override: `p-1.5` and `px-3 py-2` are not a conflict tailwind-merge can
   * resolve (a shorthand plus both axes), so an override would leave the
   * outcome to the order Tailwind happens to emit its utilities in.
   */
  content?: boolean;
  /** Additive classes only — see plant-rail.tsx's PLATE_WHILE_OPEN. */
  className?: string;
  children: ReactNode;
}) {
  const shared = cn(
    "group/chrome fixed z-40 flex gap-1",
    content ? "rounded-xl px-3 py-2" : "rounded-2xl p-1.5",
    orientation === "vertical" ? "flex-col" : "items-center",
    magnetPosition(magnet),
    CHROME_PLATE,
    className,
  );
  const side = magnetLabelSide(magnet);
  // `undefined` rather than "off", so the attribute is absent when it is not
  // wanted — `group-data-[hotkeys=on]` then has nothing to match and the public
  // zone's markup is byte-identical to what it was before shortcuts existed.
  const hotkeys = hotkeysVisible ? "on" : undefined;

  return label ? (
    <nav aria-label={label} data-side={side} data-hotkeys={hotkeys} className={shared}>
      {children}
    </nav>
  ) : (
    <div data-side={side} data-hotkeys={hotkeys} className={shared}>
      {children}
    </div>
  );
}

/**
 * The ghost box every chrome control wears.
 *
 * Exported as a string rather than hidden inside a component because three call
 * sites cannot use `ChromeLink`: log out is a submit button inside a form, the
 * palette's trigger is a client button that opens a dialog, and the plant
 * rail's is a Base UI `PopoverTrigger`. Base UI's `render` prop CLONES the
 * element it is handed and forwards its props to it, so a component that wrapped
 * the control in a span would receive the trigger's props — and its ref — on the
 * wrapper instead of on the button. Handing out the class is the composition
 * that cannot break.
 *
 * `current` is the active state: the rail's page, and the plant rail's
 * open panel.
 */
export function chromeItemClass(current?: boolean): string {
  return cn(
    "flex size-9 items-center justify-center rounded-xl transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    current
      ? "bg-accent text-accent-foreground"
      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
  );
}

/**
 * The label a chrome item shows on hover or keyboard focus.
 *
 * Three things here are deliberate:
 *
 *  - **`aria-hidden`, always.** The accessible name is the control's own
 *    `aria-label`, so what a screen reader announces does not depend on the
 *    hover affordance existing. `icon-link.tsx`'s rule, kept.
 *  - **`group-has-[:focus-visible]`, not `group-focus-visible`.** The group is
 *    the wrapper, and a wrapper is not focusable — the focus lands on the
 *    control inside it. Without `has-`, a keyboard user tabbing a cluster would
 *    get no label at all.
 *  - **The side comes from the container**, through `group-data-*`. Four
 *    complete sets of classes rather than composed fragments, because Tailwind
 *    only emits what it can read in a source file.
 */
const LABEL =
  "pointer-events-none absolute z-10 flex items-center gap-1.5 whitespace-nowrap rounded-md border bg-popover " +
  "px-2 py-1 font-heading text-xs text-popover-foreground opacity-0 shadow-md " +
  "transition-opacity group-hover/item:opacity-100 group-has-[:focus-visible]/item:opacity-100 " +
  // Holding the modifier shows every label in the cluster at once, which is a
  // different question from "what am I pointing at" — it is "what can I reach
  // from here". The rail answers it for all six items simultaneously, so the
  // shortcuts are learnable without a legend to go and read.
  "group-data-[hotkeys=on]/chrome:opacity-100 " +
  "group-data-[side=bottom]/chrome:left-1/2 group-data-[side=bottom]/chrome:top-full " +
  "group-data-[side=bottom]/chrome:mt-2 group-data-[side=bottom]/chrome:-translate-x-1/2 " +
  "group-data-[side=top]/chrome:bottom-full group-data-[side=top]/chrome:left-1/2 " +
  "group-data-[side=top]/chrome:mb-2 group-data-[side=top]/chrome:-translate-x-1/2 " +
  "group-data-[side=right]/chrome:left-full group-data-[side=right]/chrome:top-1/2 " +
  "group-data-[side=right]/chrome:ml-3 group-data-[side=right]/chrome:-translate-y-1/2 " +
  "group-data-[side=left]/chrome:right-full group-data-[side=left]/chrome:top-1/2 " +
  "group-data-[side=left]/chrome:mr-3 group-data-[side=left]/chrome:-translate-y-1/2";

/**
 * A chrome control that is not a link: the box, the label, and whatever control
 * the caller builds with `chromeItemClass()`.
 *
 * The control must carry its own `aria-label` — this component renders the
 * VISIBLE label only. `ChromeLink` writes both from one string and is the right
 * choice wherever it fits.
 */
export function ChromeItem({
  label,
  hotkey,
  children,
}: {
  label: string;
  /**
   * The shortcut, already spelled the way the key is engraved — "⌥1", "⌘K" —
   * drawn as a `<kbd>` beside the label. Absent on every control without one.
   *
   * The CALLER composes it, because choosing between "⌥" and "Alt" means
   * knowing the platform, and knowing the platform means `"use client"` — the
   * one property this file cannot spend. Whoever registers the shortcut already
   * knows what it is; this only draws it.
   */
  hotkey?: string;
  children: ReactNode;
}) {
  return (
    <span className="group/item relative flex">
      {children}
      <span aria-hidden="true" className={LABEL}>
        {label}
        {hotkey ? <Kbd>{hotkey}</Kbd> : null}
      </span>
    </span>
  );
}

/**
 * A chrome control that IS a link — eight of the eleven.
 *
 * `label` is the accessible name and the visible label, from one string, so the
 * two cannot drift.
 */
export function ChromeLink({
  href,
  label,
  current,
  hotkey,
  children,
}: {
  href: string;
  label: string;
  /** Renders `aria-current="page"` as well as the active box. */
  current?: boolean;
  /** The shortcut as engraved ("⌥1"). Visible only — the shortcut itself is
   *  registered by whoever owns the key state. */
  hotkey?: string;
  children: ReactNode;
}) {
  return (
    <ChromeItem label={label} hotkey={hotkey}>
      <a
        href={href}
        aria-label={label}
        aria-current={current ? "page" : undefined}
        className={chromeItemClass(current)}
      >
        {children}
      </a>
    </ChromeItem>
  );
}
