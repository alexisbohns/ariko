"use client";

import { useEffect, useState } from "react";
import { PaletteAutocomplete } from "./command-palette";

/**
 * The welcome page's search — the ⌘K index, inline and auto-focused.
 *
 * Not a second implementation: the input, the rows and the fetch are
 * `PaletteAutocomplete`, shared with the dialog in the chrome. What differs is
 * the shell, which is the whole of this file — a bounded flex column, so the
 * list scrolls inside 24rem instead of pushing the plant tables off the page,
 * and `autoFocus` instead of the dialog's `initialFocus`, there being no popup
 * here to take the caret away from the field.
 *
 * Script-off it renders nothing, and costs nothing: every plant it can reach is
 * a row in a table below it. The `mounted` gate is what makes that literally
 * true — `CommandPalette`'s gate, for its reason, since a server-rendered
 * palette would be a search field that looks typeable and filters nothing.
 */
export function PaletteSearch() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="mx-auto flex max-h-96 w-full max-w-xl flex-col gap-4">
      <PaletteAutocomplete autoFocus />
    </div>
  );
}
