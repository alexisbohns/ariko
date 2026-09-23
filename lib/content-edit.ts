import type { Relation, Text } from "./data";
import { textPart } from "./data";
import { extractRefs, mergeMirrored } from "./entity-refs";
import type { Lang } from "./locale";

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
 * Rules, from the Tiptap spec and the bilingual-editing spec:
 *  - §2.5 dirty-gating: an untouched open-and-save writes NOTHING, so reading a
 *    bee-written digest can never silently normalize it.
 *  - Bilingual safety: the editor edits ONE half, named by `lang`, and the
 *    other half is carried back verbatim. `lang` is REQUIRED, never defaulted —
 *    a default of "en" is exactly the value under which a future call site
 *    would silently write French text into the English half.
 *  - §2.10 mirroring: existing relations are PASSED IN, so hand-authored kinds
 *    survive. `lib/articles-store.ts` passes `undefined` here, which is right
 *    for a door that only writes unreviewed sprouts and wrong for an edit path.
 */
export function buildContentPatch(current: ContentOwner, markdown: string, lang: Lang): ContentPatchResult {
  if (new TextEncoder().encode(markdown).length > MAX_CONTENT_BYTES) {
    return { ok: false, error: `content exceeds ${MAX_CONTENT_BYTES / 1024} KiB` };
  }

  const stored = current.content;
  // textPart is STRICT — no fallback across halves, which is exactly what the
  // load side uses (lib/edit-lang.ts `editorHalves`). The two must agree or a
  // save would compare the editor's text against a string it was never given.
  if (textPart(stored, lang) === markdown) return { ok: true, dirty: false };

  const en = lang === "en" ? markdown : textPart(stored, "en");
  const fr = lang === "fr" ? markdown : textPart(stored, "fr");
  const content = composeBody(en, fr);

  return {
    ok: true,
    dirty: true,
    patch: { content, relations: mergeMirrored(current.relations, extractRefs(content)) },
  };
}

/**
 * `composeText`'s shape (lib/data.ts) WITHOUT its trimming: markdown whitespace
 * is meaningful, so a half is stored exactly as the editor serialized it.
 * "Blank" means blank once trimmed. A blank fr collapses to a plain string —
 * clearing the French body un-translates the article, and simple content stays
 * simple.
 */
function composeBody(en: string, fr: string): Text {
  const hasEn = en.trim() !== "";
  if (fr.trim() === "") return hasEn ? en : "";
  return hasEn ? { en, fr } : { fr };
}
