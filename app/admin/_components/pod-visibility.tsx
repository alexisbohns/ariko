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
 * A save closes it by STATE, never by remount — the bean head's `saved`
 * fingerprint, reduced to the one field this surface writes. The soft
 * navigation a successful save redirects to hands down a different stored
 * value, and that is the only honest signal the write landed; a save that
 * changed nothing leaves it open, which is the truth. Keying the island on the
 * value instead would remount the trigger, Base UI would find the element it
 * returns focus to detached, and focus would fall to `document.body` — a
 * keyboard author who pressed Save restarts at the top of the document.
 *
 * A rejected save comes back with `?form=visibility` and reopens onto its
 * message.
 */
export function PodVisibility({
  slug,
  visibility,
  error,
  lang,
}: {
  slug: string;
  visibility: Visibility;
  /** A rejected save's message, when `?form=visibility` named this surface. */
  error?: string;
  /** The editor half on screen, so the save lands back on it. */
  lang?: string;
}) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(visibility);

  useEffect(() => {
    if (error) setOpen(true);
  }, [error]);

  // Close on a save that landed — see the docblock.
  useEffect(() => {
    if (visibility !== seen) {
      setSeen(visibility);
      setOpen(false);
    }
  }, [visibility, seen]);

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
          lang={lang}
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
    "Off the public site, and the beans inside it leave with it, whatever their own visibility. Nothing beneath is changed.",
};
