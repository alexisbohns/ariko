"use client";

import type { ReactNode, RefObject } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
} from "@/components/ui/dialog";

/**
 * The admin's full-screen blurred sheet — the seed overlay's shell, extracted
 * once the plant page grew two more of them (Meta and Role).
 *
 * It is the SHELL and nothing else: no form, no action, no fields. Every
 * consumer passes its own <form> as children and keeps its own write path, so
 * this file can never become the place a save goes wrong.
 *
 * The primitive does the modal work rather than this file: focus containment,
 * scroll lock, inert background, Escape dismissal and focus restoration all
 * come from `Dialog.Root`'s `modal` default. Outside-press dismissal is the one
 * exception, hand-rolled on the popup below, because the popup is full-bleed
 * and so nothing is ever "outside" it for the primitive to catch.
 *
 * Both focus ends are named explicitly by the consumer: these sheets are opened
 * from two places at once (a button and a hotkey, or a title and a popover), so
 * they are controlled rather than trigger-driven and the primitive cannot infer
 * where focus came from.
 */
export function OverlaySheet({
  open,
  onOpenChange,
  label,
  initialFocus,
  finalFocus,
  children,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** The dialog's accessible name. */
  label: string;
  initialFocus?: RefObject<HTMLElement | null>;
  finalFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* The blurred surface itself. The popup above it is transparent and
            full-bleed, so the two together are a single blurred sheet rather
            than a card on a scrim. */}
        <DialogOverlay className="z-50 bg-background/70 backdrop-blur-xl supports-backdrop-filter:backdrop-blur-xl" />
        <DialogPopup
          aria-label={label}
          initialFocus={initialFocus}
          finalFocus={finalFocus}
          // The fade matches the one the registry's backdrop already carries,
          // so the sheet arrives as one surface rather than a fading blur with
          // an instant form on top of it.
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-6 py-16 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 sm:items-center sm:py-6"
          // Only a press that both starts and ends on the empty surround
          // dismisses — a drag that began inside the form and released outside
          // is a text selection, not a dismissal.
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          <DialogClose
            render={
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Close"
                className="absolute right-4 top-4"
              />
            }
          >
            <X className="size-4" />
          </DialogClose>

          {children}
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
