import type { Media } from "./data";
import { parseMediaField } from "./media-input";

/** The slice of a Sprout this module cares about. */
export interface MediaOwner {
  media?: Media[];
}

/**
 * Two cases, not three. buildContentPatch (lib/content-edit.ts) has an error
 * case because content carries a size cap; a media list has no comparable
 * failure — a malformed entry is dropped by parseMediaField rather than
 * failing the save (see its doc-comment for why). Inventing an unreachable
 * error case to match the sibling's shape would be worse than differing.
 */
export type MediaPatchResult = { dirty: false } | { dirty: true; media: Media[] };

// Order-sensitive canonical form. A reorder IS a change, so this compares
// position by position.
//
// A JSON-encoded TUPLE, not a delimiter-joined string, and not
// JSON.stringify(m) of the object itself:
//
//  - The tuple fixes field order, so a stored entry (from Mongo) and a
//    submitted one (rebuilt by the browser) canonicalize the same despite
//    differing key order. Stringifying the object directly would not: key
//    order would leak into the comparison and make an untouched list look
//    dirty.
//  - Encoding rather than joining removes delimiter injection. A `|`-joined
//    form collided: {storageKey:"a", url:"b|c"} and {storageKey:"a|b", url:"c"}
//    both produced "image|a|b|c|||", so an edit between them reported
//    dirty:false and silently wrote NOTHING — the one failure here that a user
//    could not see. `alt` is free-typed and `url` is format-unvalidated, so a
//    literal `|` is reachable input, not a hypothetical.
function canonical(m: Media): string {
  return m.kind === "image"
    ? JSON.stringify(["image", m.storageKey, m.url, m.alt ?? "", m.width ?? null, m.height ?? null])
    : JSON.stringify(["embed", m.provider, m.url, m.embedId ?? ""]);
}

function same(a: Media[], b: Media[]): boolean {
  return a.length === b.length && a.every((m, i) => canonical(m) === canonical(b[i]));
}

/**
 * Pure. The submitted list IS the new media[] — the picker owns ordering and
 * posts the whole thing, so there is nothing to diff and no client-supplied
 * intent to interpret (spec §4.4).
 *
 * Dirty-gated for the same reason buildContentPatch is: opening a sprout and
 * saving it untouched must write nothing at all.
 */
export function buildMediaPatch(current: MediaOwner, form: FormData): MediaPatchResult {
  const next = parseMediaField(form.getAll("media").map((v) => String(v)));
  const stored = current.media ?? [];
  return same(stored, next) ? { dirty: false } : { dirty: true, media: next };
}
