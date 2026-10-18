"use client";

import { useEffect, useState } from "react";
import { Globe, Lock } from "lucide-react";
import type { Visibility } from "@/lib/data";
import { visibilityLabel } from "@/lib/glyphs";
import { sweepRejection } from "@/lib/sweep-rejection";
import { setPodVisibilityAction } from "../actions";
import { FactPopover } from "./fact-popover";
import { VisibilityForm } from "./visibility-form";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * A pod's visibility: an icon that opens the vocabulary as radios behind a Save.
 *
 * The bean head's visibility trigger, on the pod page — the same `FactPopover`
 * and the same `VisibilityForm`, so the sixth enum field draws exactly as the
 * other five and nothing flips on the click that opens it.
 *
 * Closing on a save is the page's job, not this file's: the page keys this
 * island on the STORED visibility, so the soft navigation a successful save
 * redirects to remounts it closed, while a save that changed nothing leaves it
 * open — which is the truth. A rejected save comes back with `?form=visibility`
 * and reopens onto its message.
 */
export function PodVisibility({
  slug,
  visibility,
  error,
}: {
  slug: string;
  visibility: Visibility;
  /** A rejected save's message, when `?form=visibility` named this surface. */
  error?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (error) setOpen(true);
  }, [error]);

  // The accessible name states the STORED value — the only place a reader
  // learns what it is, since the hover label is CSS. lib/pod-visibility-a11y.test.ts
  // pins it.
  const label = `Visibility: ${visibilityLabel(visibility)}`;

  return (
    <TooltipProvider>
      <FactPopover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) sweepRejection();
        }}
        error={error}
        label={label}
        icon={visibility === "public" ? Globe : Lock}
        tone={visibility === "private" ? "text-foreground" : undefined}
      >
        <VisibilityForm
          action={setPodVisibilityAction}
          slug={slug}
          current={visibility}
          hints={HINTS}
          idPrefix="pod-visibility"
        />
      </FactPopover>
    </TooltipProvider>
  );
}

/** What each member does to a POD — invisible from this page, hence the hints. */
const HINTS: Record<Visibility, string> = {
  public:
    "On the public site, with its own page and its narrative — and the public beans inside it with it. No bean beneath is changed.",
  private:
    "Off the public site, and every bean inside it leaves with it, whatever its own visibility. Nothing beneath is changed.",
};
