/**
 * A narrative, as ONE LINE of plain text.
 *
 * The plant hub draws a two-line preview of the plant's narrative and links to
 * the page that edits it (`app/admin/(chrome)/plant/[slug]/narrative`). What it
 * draws is this function's output, not rendered markdown clamped with CSS, and
 * the difference is the whole reason this file exists: a clamp over rendered
 * markdown shows the first two lines of the DOCUMENT, and a document that opens
 * with a heading, an image or an entity card gives two lines of chrome and no
 * prose. Flattening first means the preview shows the first two lines of the
 * WRITING, whatever the document opens with.
 *
 * Pure, and deliberately a scan rather than a parse. `lib/markdown.ts` (remark)
 * and `lib/entity-markdown.ts` (marked) are the two real parsers, and this is
 * not a third: nothing downstream of this function is stored, linked or
 * rendered as markup — it is a sentence on a card. A shape it strips
 * imperfectly costs a slightly odd preview, never a wrong save. That is also
 * why it takes no account of escaping (`\*`): the cost of being wrong is a
 * literal asterisk missing from a hub preview.
 *
 * `stripCode` in lib/entity-refs.ts looks like this file's first three lines
 * and is not shared with it: that one drops inline code ENTIRELY, because a ref
 * inside backticks is a code sample and not a link. Here the text inside the
 * ticks is prose the author wrote, so it stays and only the ticks go.
 */

/** The default cut, in characters — about two lines of muted text at the
 *  reading measure. The caller may pass its own; the hub does not. */
export const EXCERPT_BUDGET = 200;

/** Trailing punctuation a cut should not end on, before the ellipsis. */
const DANGLING = /[\s,;:.!?—–-]+$/;

/**
 * The document, flattened to a single line.
 *
 * Order matters in three places: fences go first, so a code sample containing
 * markdown never reaches the rules below; entity directives go before links,
 * since their `[label]{ref=…}` would otherwise half-match the link rule; and
 * thematic breaks go before emphasis, because a `---` line survives the
 * emphasis rule (which never strips hyphens) and would read as a stray dash.
 */
function flatten(markdown: string): string {
  return (
    markdown
      // Fenced code — the fence and everything in it.
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/~~~[\s\S]*?~~~/g, " ")
      // Both entity forms in one rule, so the block card (no label → nothing)
      // and the inline mention (label → its text) cannot drift apart.
      .replace(/::?entity(?:\[([^\]\n]*)\])?\{[^}\n]*\}/g, (_match, label?: string) => label ?? " ")
      // Images contribute nothing: an alt text is a description of a picture,
      // not a sentence the author wrote into the narrative.
      .replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, " ")
      .replace(/\[([^\]\n]*)\]\([^)\n]*\)/g, "$1")
      // Block markers, each anchored to a line start.
      .replace(/^ {0,3}#{1,6}[ \t]+/gm, "")
      .replace(/^ {0,3}>[ \t]?/gm, "")
      .replace(/^ {0,3}(?:[-*+]|\d{1,9}[.)])[ \t]+/gm, "")
      // Thematic breaks, and a table's delimiter row — both are rows of
      // punctuation that mean something structural and read as noise.
      .replace(/^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/gm, " ")
      .replace(/^ {0,3}\|?[ \t]*:?-{2,}:?[ \t]*(?:\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/gm, " ")
      // A table's cells are prose; its pipes are not.
      .replace(/\|/g, " ")
      // Emphasis, strikethrough and inline-code ticks — the marks only.
      .replace(/[*_~`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * One line of the narrative's own words, at most `budget` characters plus an
 * ellipsis. Empty in, empty out — the caller draws its own empty state.
 *
 * The cut lands on the last word boundary inside the budget, so a preview never
 * ends mid-word; a single word longer than the whole budget has no boundary to
 * find and is cut where the budget falls, which is the one case where a hard
 * cut is better than the alternative of showing nothing.
 */
export function narrativeExcerpt(markdown: string, budget: number = EXCERPT_BUDGET): string {
  const text = flatten(markdown);
  if (text.length <= budget) return text;

  const cut = text.slice(0, budget);
  const boundary = cut.lastIndexOf(" ");
  const kept = boundary > 0 ? cut.slice(0, boundary) : cut;
  return `${kept.replace(DANGLING, "")}…`;
}
