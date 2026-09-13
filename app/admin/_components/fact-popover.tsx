"use client";

import { type ComponentType, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * One fact: an icon that opens its editor, and nothing else.
 *
 * The icon is a trigger and NOT a submit — the whole point. The form lives
 * inside the popover, which Base UI unmounts on close, so an abandoned edit is
 * discarded with nothing to reset by hand. An abandoned edit is not a pending
 * write.
 *
 * `aria-label` states the STORED value, on the control rather than on a visible
 * span, because the hover label is CSS. `lib/sprout-hero-a11y.test.ts` pins it.
 */
export function FactPopover({
  open,
  onOpenChange,
  label,
  icon: Icon,
  tone,
  error,
  children,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone?: string;
  /**
   * A rejected save's message, when this is the surface it came from.
   *
   * It has to render HERE, beside the field, and that is the entire point of
   * routing `?form=` back to a surface: reopening a popover onto silence tells
   * the author only that their click did nothing. The page-level banner cannot
   * cover for it either — the page suppresses that banner precisely when
   * `?form=` names a surface, so without this line the message is not shown
   * anywhere at all.
   */
  error?: string;
  children: ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button type="button" size="icon" variant="ghost" aria-label={label}>
                  <Icon className={`size-4 ${tone ?? "text-muted-foreground"}`} />
                </Button>
              }
            />
          }
        />
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      <PopoverContent side="bottom" align="center" className="w-72 text-left">
        {error ? (
          <Alert variant="destructive" role="alert" className="mb-3">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {children}
      </PopoverContent>
    </Popover>
  );
}
