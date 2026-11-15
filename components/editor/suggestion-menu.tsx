"use client";

import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export interface MenuItem {
  id: string;
  label: string;
  hint?: string;
}

/**
 * Positioned with `position: fixed` from the caret rect that @tiptap/suggestion
 * hands us via `clientRect()` — which is why this needs no floating-ui or
 * popper dependency. Portalled to the body: a transformed ancestor (the map's
 * entity sheet) is the containing block for `position: fixed`, which would turn
 * these viewport coordinates into sheet-relative ones.
 *
 * onMouseDown (not onClick) with preventDefault: a click would blur the editor
 * before the command ran, and the suggestion range would already be gone.
 */
export function SuggestionMenu({
  items,
  activeIndex,
  rect,
  onPick,
}: {
  items: MenuItem[];
  activeIndex: number;
  rect: DOMRect | null;
  onPick: (index: number) => void;
}) {
  if (!rect || items.length === 0) return null;

  return createPortal(
    <div
      role="listbox"
      style={{ position: "fixed", top: rect.bottom + 6, left: rect.left, zIndex: 50 }}
      className="max-h-64 w-72 overflow-y-auto rounded-lg border bg-background p-1 shadow-md"
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(index);
          }}
          className={cn(
            "flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-sm",
            index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
          )}
        >
          <span>{item.label}</span>
          {item.hint ? (
            <span className="font-heading text-xs text-muted-foreground">{item.hint}</span>
          ) : null}
        </button>
      ))}
    </div>,
    document.body,
  );
}
