"use client";

import { useEffect, useState } from "react";
import { PaletteAutocomplete } from "./command-palette";

/**
 * The welcome page's search — the ⌘K index behind an ordinary field.
 *
 * Not a second implementation: the input, the rows and the fetch are
 * `PaletteAutocomplete`, shared with the dialog in the chrome. What differs is
 * the SURFACE, and this is the file that picks it.
 *
 * It picks the popover, and the first version picked wrong. Rendering the list
 * inline made the landing page open onto a permanently-open, permanently
 * scrolling index: a screenful of rows nobody asked for, sitting between the
 * greeting and the plants, re-laying itself out under the caret on every
 * keystroke. A search field should look like a search field until it has
 * something to say. So the list is a popup anchored under the input, and it
 * opens on the first character — not on focus, not on click.
 *
 * THE HEIGHT IS RESERVED WHETHER OR NOT THE FIELD IS THERE, which is what the
 * outer div is for. The island cannot render before it mounts (see below), so
 * without a reserved box the plant tables would be drawn once at the top of the
 * page and then shoved down the instant hydration finished — a jump on every
 * single load of the admin's front door. A popup costs no layout at all, so the
 * box only ever has to be as tall as the field.
 *
 * Script-off it renders nothing, and costs nothing: every plant it can reach is
 * a row in a table below it. The `mounted` gate is what makes that literally
 * true — `CommandPalette`'s gate, for its reason, since a server-rendered
 * palette would be a search field that looks typeable and filters nothing.
 */
export function PaletteSearch() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="mx-auto h-12 w-full max-w-xl">
      {mounted ? <PaletteAutocomplete surface="popover" autoFocus /> : null}
    </div>
  );
}
