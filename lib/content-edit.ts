import type { Relation, Text } from "./data";
import { textPart } from "./data";
import { extractRefs, mergeMirrored } from "./entity-refs";

// The article door's ceiling (article-door spec §4), applied to the same field
// from the authoring side so the two doors agree on what fits.
export const MAX_CONTENT_BYTES = 64 * 1024;

/** The slice of a Sprout / Plant / Pod this module cares about. */
export interface ContentOwner {
  content?: Text;
  relations?: Relation[];
}

export interface ContentPatch {
  content: Text;
  relations: Relation[];
}

export type ContentPatchResult =
  | { ok: true; dirty: false }
  | { ok: true; dirty: true; patch: ContentPatch }
  | { ok: false; error: string };

/**
 * Pure. Turns the editor's markdown into the fields to write, or says the
 * document is unchanged.
 *
 * Three rules, all from the spec:
 *  - §2.5 dirty-gating: an untouched open-and-save writes NOTHING, so reading a
 *    bee-written digest can never silently normalize it.
 *  - §2.9 bilingual safety: the editor edits `en` only; a stored `fr` half is
 *    carried back verbatim.
 *  - §2.10 mirroring: existing relations are PASSED IN, so hand-authored kinds
 *    survive. `lib/articles-store.ts` passes `undefined` here, which is right
 *    for a door that only writes unreviewed sprouts and wrong for an edit path.
 */
export function buildContentPatch(current: ContentOwner, markdown: string): ContentPatchResult {
  if (new TextEncoder().encode(markdown).length > MAX_CONTENT_BYTES) {
    return { ok: false, error: `content exceeds ${MAX_CONTENT_BYTES / 1024} KiB` };
  }

  const stored = current.content;
  // textPart is STRICT — no fallback from a blank `en` to `fr`, which is
  // exactly what the load side uses (app/admin/_components/content-card.tsx).
  // The two must agree or a save would compare the editor's text against a
  // string it was never given.
  if (textPart(stored, "en") === markdown) return { ok: true, dirty: false };

  const frPart =
    typeof stored === "object" && stored !== null && typeof stored.fr === "string" ? stored.fr : "";
  const content: Text = frPart ? { en: markdown, fr: frPart } : markdown;

  return {
    ok: true,
    dirty: true,
    patch: { content, relations: mergeMirrored(current.relations, extractRefs(content)) },
  };
}
