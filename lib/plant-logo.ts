import type { MediaImage } from "./data";
import { parseMediaField } from "./media-input";

/** The slice of a Plant this module cares about. */
export interface LogoOwner {
  logo?: MediaImage;
}

/** `logo: null` MEANS clear — the writer turns it into an `$unset`. */
export type LogoPatchResult = { dirty: false } | { dirty: true; logo: MediaImage | null };

// Order-insensitive here (there is only ever one), but field-order-sensitive
// for the same reason lib/media-edit.ts's canonical() is: a stored entry comes
// back from Mongo and a submitted one is rebuilt by the browser, so key order
// differs and JSON.stringify of the object itself would report an untouched
// logo as dirty. A fixed tuple removes that, and encoding rather than joining
// removes delimiter injection through the free-typed `alt`.
function canonical(logo: MediaImage | null): string {
  return logo === null
    ? "null"
    : JSON.stringify([logo.storageKey, logo.url, logo.alt ?? "", logo.width ?? null, logo.height ?? null]);
}

/**
 * Pure, aside from one diagnostic warning. A sibling of buildMediaPatch
 * (lib/media-edit.ts) rather than a generalization of it: that one owns an
 * ORDERED LIST where order is an authoring act, this one owns a single image,
 * and the two only look alike because they share a picker.
 *
 * Dirty-gated: opening the plant page and saving the card untouched must write
 * nothing at all.
 */
export function buildPlantLogoPatch(current: LogoOwner, form: FormData): LogoPatchResult {
  const raw = form.getAll("logo").map((v) => String(v));
  const stored = current.logo ?? null;

  // The picker never mounted (script off, or a submit that beat hydration), so
  // this form does not know what the plant holds — it is not a clear. The
  // marker is rendered whenever MediaPicker is mounted, independent of row
  // count, so its ABSENCE is unambiguous where a zero-field submission is not.
  //
  // Defence in depth rather than the sole protection: the card's submit button
  // lives INSIDE the island (MediaPicker's `submitLabel`), so an unmounted
  // picker leaves no button to press. This guard covers what a missing button
  // cannot — a replayed or scripted POST straight to the server action.
  //
  // Hard-coded to match the hard-coded getAll("logo") above: the two names are
  // one contract with the "logo" surface, so parameterising one would let them
  // drift.
  if (!form.has("logo__ready")) return { dirty: false };

  // A logo is a square image by definition, so an embed is not a candidate —
  // and `links={false}` on the picker is the UI saying so, not the contract.
  const next = parseMediaField(raw).find((m) => m.kind === "image") ?? null;

  // Entries were submitted and NONE of them yielded an image: a failed save,
  // not a clear. The two shapes are distinguishable without guessing —
  // removing the row submits ZERO fields, while a corrupted or embed-only save
  // submits N. Writing nothing is the safe failure: the stored logo survives,
  // and re-saving after the client bug is fixed still works.
  if (raw.length > 0 && next === null && stored !== null) {
    // The one diagnostic in this otherwise pure module, for the reason
    // buildMediaPatch gives: without it, a client bug that trips this guard is
    // indistinguishable from an ordinary no-op save and the admin just sees
    // "my edit didn't take" with no trail.
    console.warn(
      `[media] buildPlantLogoPatch: ${raw.length} submitted field(s) yielded no image — write skipped, stored logo unchanged`,
    );
    return { dirty: false };
  }

  return canonical(stored) === canonical(next) ? { dirty: false } : { dirty: true, logo: next };
}
