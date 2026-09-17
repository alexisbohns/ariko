import type { CSSProperties } from "react";

/**
 * The mount sequence's one helper, and the only place `--i` is spelled.
 *
 * The animations themselves live in `app/globals.css` — `mark-in` for the
 * landing's mark, `reveal` for a block that waits for the fold, `reveal-in` for
 * a block that takes its place in a stagger, `reveal-each` for a container that
 * hands the scroll-driven reveal to its own children. All four are CSS: the
 * public zone is progressively enhanced, so a reveal that gated content on an
 * island would make every page blank script-off (CLAUDE.md §"Script, by zone").
 *
 * **Server-safe**, and it has to be: `components/plant-header.tsx` calls it and
 * that file serves the public page and an admin client island at once.
 *
 * The index is handed in rather than counted, for the reason the landing page
 * already found: a head composed of optional slots, or a list rendered by a
 * second `map`, restarts a self-counting stagger halfway down the page. Ordinal
 * position in the DOM is not the same question as order of arrival.
 */
export function seq(index: number, className?: string) {
  return {
    className: className ? `reveal-in ${className}` : "reveal-in",
    style: { "--i": index } as CSSProperties,
  };
}
