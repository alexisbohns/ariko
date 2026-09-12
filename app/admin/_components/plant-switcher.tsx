"use client";

import { ChevronsUpDown } from "lucide-react";
import { useId, type ReactNode } from "react";
import { EntityAvatar } from "@/components/admin/glyphs";
import { ChromeItem, chromeItemClass } from "@/components/chrome";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FilterValues } from "@/lib/admin-filters";
import { scopeHref } from "@/lib/admin-scope";
import type { Visibility } from "@/lib/data";

/** What the chrome needs to draw a plant: the layout composes these and hands
 *  them down, the way the plant page hands down its Exhibition panel. */
export interface PlantMark {
  slug: string;
  name: string;
  logoUrl?: string;
  visibility: Visibility;
}

/**
 * The admin's subject, as a control.
 *
 * EVERY ROW IS A PLAIN ANCHOR. Picking a plant is a navigation, not a write —
 * no server action, no cookie — which is what makes the resulting URL a
 * description of the view, and what makes this island inert rather than
 * destructive with script off: it simply never opens, and every destination it
 * offers is also a row in a table on the root.
 *
 * Where each row points is `lib/admin-scope.ts`'s decision, not this file's: on
 * a filtering section it sets the dimension and keeps the others, and anywhere
 * else it opens the plant's hub. That module had to be made client-safe for
 * this import to build at all — see `lib/section-keys.ts`.
 *
 * `pathname` and `active` arrive as PROPS rather than from `usePathname` /
 * `useSearchParams` here, because `AdminChrome` has already read both to
 * resolve the scope it passes in. One subscription, one reading — and it is
 * what lets `lib/plant-switcher-a11y.test.ts` render this with
 * `renderToStaticMarkup`, outside any router, to read the trigger's accessible
 * name back out of the markup.
 */
export function PlantSwitcher({
  plants,
  scope,
  pathname,
  active,
}: {
  plants: PlantMark[];
  scope: string | null;
  pathname: string;
  active: FilterValues;
}) {
  const publishedId = useId();
  const privateId = useId();

  // A scope naming a plant the garden does not hold resolves to nothing, so the
  // trigger reads "All" — the same place every other unresolvable scope lands,
  // and the behaviour `lib/inbox-filter.ts`'s docblock already promises from
  // the other side: `?plant=ghost` narrows the rows to the seeds that say
  // "ghost" while the chrome above says All.
  const current = scope ? plants.find((plant) => plant.slug === scope) : undefined;

  // The stored value, in the accessible name AND in the hover label, from one
  // string — `plant-hero.tsx`'s arrangement for its five icon triggers, and
  // `lib/plant-hero-a11y.test.ts`'s reason for existing: an icon is not a
  // label, so this name is the only place a reader learns what the scope IS.
  // A bare "Plant" would look identical and would stop saying anything.
  const label = `Plant: ${current ? current.name : "All"}`;

  const groups = [
    // `!== "public"` rather than `=== "private"`: every plant belongs to
    // exactly one of the two lists, whatever the vocabulary grows to — the
    // welcome page's split, which is the table these rows shadow.
    { id: publishedId, title: "Published", rows: plants.filter((p) => p.visibility === "public") },
    { id: privateId, title: "Private", rows: plants.filter((p) => p.visibility !== "public") },
  ];

  return (
    <Popover>
      <ChromeItem label={label}>
        <PopoverTrigger aria-label={label} className={chromeItemClass()}>
          {current ? (
            <EntityAvatar mark={{ name: current.name, logoUrl: current.logoUrl }} />
          ) : (
            <ChevronsUpDown className="size-4" />
          )}
        </PopoverTrigger>
      </ChromeItem>

      <PopoverContent align="start" className="max-h-[70vh] w-64 gap-1 overflow-y-auto p-1">
        <ul>
          <li>
            <Row href={scopeHref(pathname, active, null)} current={!scope}>
              <ChevronsUpDown className="size-6 shrink-0 p-1 text-muted-foreground" />
              All plants
            </Row>
          </li>
        </ul>

        {groups.map((group) =>
          group.rows.length === 0 ? null : (
            <div key={group.id} className="flex flex-col">
              {/* Labelled rather than merely ordered: published-then-private is
                  invisible to anyone who cannot see the order, and the two
                  lists are the same distinction the root draws as two tables. */}
              <p id={group.id} className="px-2 pb-1 pt-2 font-heading text-xs text-muted-foreground">
                {group.title}
              </p>
              <ul aria-labelledby={group.id}>
                {group.rows.map((plant) => (
                  <li key={plant.slug}>
                    <Row
                      href={scopeHref(pathname, active, plant.slug)}
                      current={plant.slug === scope}
                    >
                      <EntityAvatar mark={{ name: plant.name, logoUrl: plant.logoUrl }} />
                      {plant.name}
                    </Row>
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}
      </PopoverContent>
    </Popover>
  );
}

/** One destination. `aria-current` rather than a tick glyph: the row the view
 *  is already on is a fact about this list, not a value the author picked. */
function Row({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-current={current ? "true" : undefined}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
        current ? "bg-accent/60 text-foreground" : "text-muted-foreground"
      }`}
    >
      {children}
    </a>
  );
}
