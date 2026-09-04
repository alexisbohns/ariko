"use client";

import { CircleDot, Sprout, Tag } from "lucide-react";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * The vault's three filter dimensions, collapsed into popovers.
 *
 * A container and nothing more: every option inside is the same <a href> the
 * page used to render inline, built by the page's own vaultHref, so filtering
 * stays server-side and a filter URL stays shareable. Client only because a
 * popover is.
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

const ICONS: Record<FilterGroup["key"], ComponentType<{ className?: string }>> = {
  state: CircleDot,
  plant: Sprout,
  tag: Tag,
};

export function VaultFilters({ groups }: { groups: FilterGroup[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {groups.map((group) => {
        const Icon = ICONS[group.key];
        const filtered = group.current !== "all";
        return (
          <Popover key={group.key}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  variant={filtered ? "secondary" : "ghost"}
                  aria-label={`Filter by ${group.key}`}
                >
                  <Icon className="size-3.5" />
                  {filtered ? <span className="text-xs">{group.current}</span> : null}
                </Button>
              }
            />
            <PopoverContent align="start" className="w-48">
              <div className="flex flex-col gap-1">
                <span className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
                  {group.key}
                </span>
                {group.options.map((opt, i) => (
                  <a
                    key={opt}
                    href={group.hrefs[i]}
                    aria-current={opt === group.current ? "true" : undefined}
                    className="rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent"
                  >
                    {opt === group.current ? (
                      <Badge className="px-1.5 py-0">{opt}</Badge>
                    ) : (
                      opt
                    )}
                  </a>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
