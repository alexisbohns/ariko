"use client";

import { useState } from "react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { CircleDot, Sprout, Tag } from "lucide-react";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * The vault's three filter dimensions, collapsed into popovers.
 *
 * A container and nothing more: every option inside is the same <a href> the
 * page used to render inline, built by the page's own vaultHref, so filtering
 * stays server-side and a filter URL stays shareable. Client only because a
 * popover is — and now because of the hotkeys, which are the same kind of
 * shell-only affordance the seed overlay's `k` is: script-off costs discovery
 * (the triggers do not open, the keys do nothing), never a filter.
 *
 * All three dimensions are one component rendered three times, `FilterPopover`
 * below, driven by the DIMENSIONS table — the icon, the hotkey and the trigger
 * are written once. The popover itself is the registry primitive
 * (`components/ui/popover.tsx`, shadcn on Base UI), never a hand-rolled one,
 * which is where the keyboard behaviour comes from rather than from this file.
 */

export interface FilterGroup {
  /** The dimension, used as the trigger's label. */
  key: "state" | "plant" | "tag";
  /** Every option, "all" first — already resolved by the page. */
  options: string[];
  /** The active option, or "all". */
  current: string;
  /** href for each option, in the same order as `options`. */
  hrefs: string[];
}

/**
 * Icon and hotkey per dimension. The keys are the dimensions' own initials —
 * `s`tate, `p`lant, `t`ag — spelled uppercase because @tanstack/react-hotkeys
 * canonicalises letter keys to uppercase and carries Shift as a separate flag,
 * so these are unshifted presses, not Shift+letter. (The same spelling the seed
 * overlay's "K" uses.)
 */
const DIMENSIONS = {
  state: { icon: CircleDot, hotkey: "S" },
  plant: { icon: Sprout, hotkey: "P" },
  tag: { icon: Tag, hotkey: "T" },
} as const satisfies Record<
  FilterGroup["key"],
  { icon: ComponentType<{ className?: string }>; hotkey: string }
>;

export function VaultFilters({ groups }: { groups: FilterGroup[] }) {
  // One dimension open at a time, tracked here rather than in each popover:
  // three independently uncontrolled popovers could all be open at once, and a
  // hotkey needs to know whether *another* one already holds focus.
  const [open, setOpen] = useState<FilterGroup["key"] | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {groups.map((group) => (
        <FilterPopover
          key={group.key}
          group={group}
          open={open === group.key}
          anyOpen={open !== null}
          onOpenChange={(next) =>
            setOpen((current) =>
              next ? group.key : current === group.key ? null : current,
            )
          }
        />
      ))}
    </div>
  );
}

function FilterPopover({
  group,
  open,
  anyOpen,
  onOpenChange,
}: {
  group: FilterGroup;
  open: boolean;
  anyOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { icon: Icon, hotkey } = DIMENSIONS[group.key];
  const filtered = group.current !== "all";

  // Disabled while any of the three is open, which is what keeps the trapped
  // focus honest: with a popover up, the keys that opened it are inert and
  // Escape is the way out (returning focus to the trigger, from the
  // primitive). The library's defaults are relied on for the rest — a bare
  // single key defaults to ignoreInputs:true, so these never fire from a text
  // field elsewhere on the page.
  useHotkey(hotkey, () => onOpenChange(true), { enabled: !anyOpen });

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      // Focus is trapped in the popup, page scroll and outside pointers are
      // not: Tab and Shift+Tab cycle the options instead of walking off into
      // the table behind, which is the whole of "navigate within the popover".
      // Escape closes and restores focus to the trigger. Base UI asks for a
      // Close inside the popup under this mode, for touch screen readers —
      // that is the sr-only one below.
      modal="trap-focus"
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant={filtered ? "secondary" : "ghost"}
            aria-label={`Filter by ${group.key} (${hotkey.toLowerCase()})`}
          >
            <Icon className="size-3.5" />
            {filtered ? <span className="text-xs">{group.current}</span> : null}
          </Button>
        }
      />
      <PopoverContent
        align="start"
        className="w-48"
        aria-label={`${group.key} filter`}
        // The primitive's default: the first tabbable element inside the popup,
        // which is the first option link. Named rather than left implicit
        // because opening from a hotkey has no trigger press to infer from.
        initialFocus
      >
        <div className="flex flex-col gap-1">
          <span className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
            {group.key}
          </span>
          {group.options.map((opt, i) => (
            <a
              key={opt}
              href={group.hrefs[i]}
              aria-current={opt === group.current ? "true" : undefined}
              className="rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {opt === group.current ? (
                <Badge className="px-1.5 py-0">{opt}</Badge>
              ) : (
                opt
              )}
            </a>
          ))}
          <PopoverClose className="sr-only">Close {group.key} filter</PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}
