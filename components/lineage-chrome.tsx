import type { ComponentType, ReactNode } from "react";

import { Chrome, ChromeItem, ChromeLink, chromeItemClass } from "./chrome";
import type { ChromeAnchorProps } from "./chrome";
import { PlantMarkContent } from "./plant-header";
import { BeanIcon, PodIcon } from "./public-icons";
import type { Lineage, LineageEntry, LineageTier } from "@/lib/lineage";
import { cn } from "@/lib/utils";

/**
 * The parenting chrome — where the entity you are looking at hangs from.
 *
 * `plant | pod | bean`, outermost first, one item per TIER rather than one per
 * parent: the tiers are what the model guarantees (a sprout is always under
 * beans, a bean always under pods or plants), while the count within a tier is
 * data. So the row's shape is stable and only an item's behaviour changes.
 *
 * **Server-safe, and that is load-bearing** — no `"use client"`, no
 * `lucide-react`, no `next/link`, no `node:`. `lib/server-safe-source.test.ts`
 * pins all four, because every one of them passes `tsc`, `npm test` AND
 * `npm run build` while costing the public zone its navigation. It is why the
 * pod and bean glyphs come from `components/public-icons.tsx` and why the
 * lineage arrives as a TYPE from `lib/lineage.ts` — whose runtime half reaches
 * `lib/data.ts`, which opens with `node:fs`.
 *
 * **A `<details>` rather than a popover**, for a tier with several parents.
 * Base UI's Popover is a client component, and reaching for it would make
 * moving up a tier script-dependent in the one zone whose rule is that nothing
 * is. A disclosure is server-rendered and complete with script off, and it is
 * the same element in both zones — so this stays one file rather than one file
 * with two behaviours. The known costs, stated rather than discovered: no
 * outside-click dismissal, and the panel is in flow beneath the plate.
 *
 * **A tier of ONE is a plain link, not a disclosure of one.** The common case
 * is one bean under one pod under one plant, and a menu of one is a click that
 * costs a click. The accessible name is then the PARENT'S name — the only place
 * a reader learns which parent this is — which is the icon-trigger rule
 * (`lib/plant-hero-a11y.test.ts`) applied to navigation.
 *
 * The entity itself is not an item: this cluster says where you are FROM, and
 * the page's own header already says what you are looking at.
 */

/** The tier's word, plural — the disclosure summary's accessible name is
 *  `Beans: Alpha, Beta`. It names the PARENTS, not their count: every icon
 *  trigger in this repo names its stored value, and `<summary>`'s own role
 *  already conveys expand/collapse, so a number would be the one thing a reader
 *  cannot act on. A tier of ONE never reaches here: its name is that parent's
 *  name, per the rule above, so there is no singular form for anything to read. */
const TIER_WORD: Record<LineageTier["kind"], string> = {
  plant: "Plants",
  pod: "Pods",
  bean: "Beans",
};

/** The glyph inside an item. A plant draws its MARK — the logo over a monogram,
 *  both in the server HTML (`PlantMarkContent`) — because a plant is recognised
 *  by its logo everywhere else in the product, and a generic flower here would
 *  be the one place it is not. */
function TierGlyph({ kind, entry }: { kind: LineageTier["kind"]; entry: LineageEntry }) {
  if (kind === "plant") {
    return (
      <span aria-hidden="true" className="size-5 overflow-hidden rounded-[28%] bg-muted">
        <PlantMarkContent logoUrl={entry.logoUrl} name={entry.name} />
      </span>
    );
  }
  const Icon = kind === "pod" ? PodIcon : BeanIcon;
  return <Icon className="size-4" />;
}

function TierItem({
  tier,
  as,
}: {
  tier: LineageTier;
  as?: "a" | ComponentType<ChromeAnchorProps>;
}): ReactNode {
  const [first, ...rest] = tier.entries;
  if (!first) return null;

  if (rest.length === 0) {
    return (
      <ChromeLink href={first.href} label={first.name} as={as}>
        <TierGlyph kind={tier.kind} entry={first} />
      </ChromeLink>
    );
  }

  const Anchor = as ?? "a";
  // One string for the accessible name AND the hover label, as `ChromeLink`
  // does: without the `ChromeItem` wrapper the disclosure would be the one
  // control in the cluster that says nothing when you point at it.
  const label = `${TIER_WORD[tier.kind]}: ${tier.entries.map((entry) => entry.name).join(", ")}`;
  return (
    <ChromeItem label={label}>
      <details className="relative">
        <summary
          aria-label={label}
          className={cn(chromeItemClass(), "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}
        >
          <TierGlyph kind={tier.kind} entry={first} />
        </summary>
        {/* A popover surface, not CHROME_PLATE — see the docblock. */}
        <ul className="absolute left-1/2 top-full z-10 mt-2 min-w-40 -translate-x-1/2 rounded-xl border bg-popover p-1 text-popover-foreground shadow-md">
          {tier.entries.map((entry) => (
            <li key={entry.slug}>
              <Anchor
                href={entry.href}
                className="block rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              >
                {entry.name}
              </Anchor>
            </li>
          ))}
        </ul>
      </details>
    </ChromeItem>
  );
}

export function LineageChrome({
  lineage,
  as,
}: {
  lineage: Lineage;
  /**
   * The anchor, exactly as `ChromeLink` takes it and for exactly its reason:
   * the admin passes `next/link` for a soft navigation, the public zone passes
   * nothing and gets `<a>`. Importing `next/link` HERE would put a client
   * boundary under every public page.
   */
  as?: "a" | ComponentType<ChromeAnchorProps>;
}) {
  // Nothing at all, rather than an empty plate floating at the top of a page
  // that has no parents to show. A plant's own page lands here.
  if (lineage.length === 0) return null;

  return (
    <Chrome magnet="top-center" label="Parents">
      {lineage.map((tier) => (
        <TierItem key={tier.kind} tier={tier} as={as} />
      ))}
    </Chrome>
  );
}
