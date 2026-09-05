/**
 * The TOC rail's model. Pure, JSX-free and DOM-free so `npm test` can reach it:
 * the rail itself is a client component that reads the rendered document, and
 * the only part of it worth pinning is the arithmetic.
 *
 * The headings are NOT extracted here. `lib/markdown.ts` already runs
 * rehypeSlug, so the rail reads the ids off the rendered DOM rather than
 * re-walking the markdown — a fourth reader of the one corpus is exactly the
 * shape the tiptap slice's conformance work found five defects in, and a slug
 * algorithm that disagrees with rehypeSlug's in one edge case produces a rail
 * whose links quietly go nowhere.
 */

export interface TocHeading {
  /** The rehypeSlug id, already on the rendered heading. */
  id: string;
  text: string;
  level: 2 | 3;
}

/** Where a row sits relative to the reader. */
export type TocState = "passed" | "active" | "default";

/**
 * A single dash is a claim about structure that a page with no structure cannot
 * support, so the rail withdraws entirely below this.
 */
export const TOC_MIN_HEADINGS = 2;

/**
 * `activeIndex` is -1 before any heading has crossed the reading line — the top
 * of the document, where nothing has been passed and nothing is current. The
 * `index < activeIndex` test gives that for free: with -1 no row is passed and
 * no row is active, which is the truth rather than a special case.
 */
export function tocState(index: number, activeIndex: number): TocState {
  if (index === activeIndex) return "active";
  return index < activeIndex ? "passed" : "default";
}

export function shouldRenderToc(headings: readonly TocHeading[]): boolean {
  return headings.length >= TOC_MIN_HEADINGS;
}
