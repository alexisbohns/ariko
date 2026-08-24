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
 * Pure, aside from one diagnostic warning on the guarded path below. The
 * submitted list IS the new media[] — the picker owns ordering and
 * posts the whole thing, so there is nothing to diff and no client-supplied
 * intent to interpret (spec §4.4).
 *
 * Dirty-gated for the same reason buildContentPatch is: opening a sprout and
 * saving it untouched must write nothing at all.
 */
export function buildMediaPatch(current: MediaOwner, form: FormData): MediaPatchResult {
  const raw = form.getAll("media").map((v) => String(v));
  const next = parseMediaField(raw);
  const stored = current.media ?? [];

  // The picker never mounted (script off, or a submit that beat hydration), so
  // this form does not know what it holds — it is not a clear-all. The marker
  // is rendered by MediaPicker whenever it is mounted, independent of row
  // count, so its ABSENCE is unambiguous where a zero-field submission is not.
  //
  // Without this, a script-off "Save media" on a sprout with stored images
  // silently $set media:[] and deleted all of them: the parse-failure guard
  // below requires raw.length > 0 and so does not fire, and same(stored, [])
  // is false, so it read as a deliberate clear-all.
  //
  // Defence in depth rather than the sole protection: the sprout media form's
  // submit button now lives INSIDE the island too (MediaPicker's `submitLabel`),
  // so an unmounted picker leaves no button to press and closes the user-facing
  // path entirely. This guard covers what a missing button cannot — a replayed
  // or scripted POST straight to the server action, which never renders a
  // button at all.
  //
  // Hard-coded to match this function's hard-coded getAll("media") — the two
  // names are one contract with the "media" surface, so parameterising only one
  // of them would let them drift.
  if (!form.has("media__ready")) return { dirty: false };

  // A save that submitted entries but parsed NONE of them is not a clear-all —
  // it is a failed save, and treating it as a clear-all would $set an empty
  // media[] over a stored list with no signal to anyone.
  //
  // The two are distinguishable without guessing: removing every entry submits
  // ZERO fields (the picker renders no hidden input for a list it does not
  // have), while a corrupted save submits N fields that all fail to parse. Only
  // the second shape lands here.
  //
  // parseMediaField's drop-don't-reject policy is right at the per-entry
  // granularity it was written for ("one bad entry must never cost a capture").
  // This is the same policy at LIST granularity, where dropping everything
  // stops being lenient and starts being destructive. Writing nothing is the
  // safe failure: the stored list survives, and re-saving after the client bug
  // is fixed still works. Unreachable in normal operation — the picker emits
  // JSON.stringify of its own state — which is exactly why it must not be
  // silent data loss when it does happen.
  if (raw.length > 0 && next.length === 0 && stored.length > 0) {
    // The one diagnostic in this otherwise pure module. Without it a client bug
    // that trips this guard is indistinguishable, from the operator's side,
    // from an ordinary no-op save: no exception, no log, the redirect proceeds.
    // The admin just sees "my edit didn't take" with no trail. It belongs HERE
    // rather than in the calling action: the action cannot reconstruct this
    // condition without re-running parseMediaField, and the cheap approximation
    // (not dirty, yet fields were submitted) also matches the common
    // opened-and-saved-untouched case, which would bury the real signal.
    console.warn(
      `[media] buildMediaPatch: ${raw.length} submitted field(s) all failed to parse — write skipped, stored media unchanged`,
    );
    return { dirty: false };
  }

  return same(stored, next) ? { dirty: false } : { dirty: true, media: next };
}
