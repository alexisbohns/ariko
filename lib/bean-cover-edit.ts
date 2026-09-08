import type { MediaImage } from "./data";
import { parseMediaField } from "./media-input";

/** The slice of a Bean this module cares about. */
export interface CoverOwner {
  cover?: MediaImage;
}

/** `cover: null` MEANS clear — the writer turns it into an `$unset`. */
export type CoverPatchResult = { dirty: false } | { dirty: true; cover: MediaImage | null };

// Field-order-sensitive, for the reason lib/plant-logo.ts's canonical() gives: a
// stored entry comes back from Mongo and a submitted one is rebuilt by the
// browser, so key order differs and JSON.stringify of the object itself would
// report an untouched cover as dirty. A fixed tuple removes that, and encoding
// rather than joining removes delimiter injection through the free-typed `alt`.
//
// width/height are IN the tuple, and that is load-bearing rather than
// completeness: lib/bean-cover.ts reads them to decide the phone treatment, so
// a re-upload that changed only the dimensions is a real edit.
function canonical(cover: MediaImage | null): string {
  return cover === null
    ? "null"
    : JSON.stringify([
        cover.storageKey,
        cover.url,
        cover.alt ?? "",
        cover.width ?? null,
        cover.height ?? null,
      ]);
}

/**
 * Pure, aside from one diagnostic warning. A SIBLING of buildPlantLogoPatch
 * rather than a generalization of it — the two are the same three guards over a
 * different field, and merging them would mean one function owning two
 * surfaces' field names, which is exactly the drift each hard-codes its own name
 * to prevent.
 *
 * Dirty-gated: opening the bean page and saving the card untouched must write
 * nothing at all.
 *
 * siblings: lib/media-edit.ts (buildMediaPatch), lib/plant-logo.ts
 * (buildPlantLogoPatch), lib/screen-image.ts (buildScreenImagePatch) — the same
 * three guards over an ordered list (`buildMediaPatch`) and a single image (the
 * other two). Fix the `__ready` guard or the failed-save discriminator here and
 * check whether it applies there too.
 */
export function buildBeanCoverPatch(current: CoverOwner, form: FormData): CoverPatchResult {
  const raw = form.getAll("cover").map((v) => String(v));
  const stored = current.cover ?? null;

  // The picker never mounted (script off, or a submit that beat hydration), so
  // this form does not know what the bean holds — it is not a clear. The marker
  // is rendered whenever MediaPicker is mounted, independent of row count, so
  // its ABSENCE is unambiguous where a zero-field submission is not.
  //
  // Defence in depth rather than the sole protection: the card's submit button
  // lives INSIDE the island (MediaPicker's `submitLabel`), so an unmounted
  // picker leaves no button to press. This guard covers what a missing button
  // cannot — a replayed or scripted POST straight to the server action.
  if (!form.has("cover__ready")) return { dirty: false };

  // A cover is an image. An embed is not a candidate, and `links` is off on the
  // picker — but that is the UI saying so, not the contract.
  const next = parseMediaField(raw).find((m): m is MediaImage => m.kind === "image") ?? null;

  // Entries were submitted and NONE of them yielded an image: a failed save, not
  // a clear. Removing the row submits ZERO fields, while a corrupted or
  // embed-only save submits N — the two shapes are distinguishable without
  // guessing. Writing nothing is the safe failure: the stored cover survives.
  if (raw.length > 0 && next === null && stored !== null) {
    // The one diagnostic in this otherwise pure module. Without it, a client
    // bug that trips this guard is indistinguishable from an ordinary no-op
    // save: no exception, no log, the redirect proceeds — the author just sees
    // "my edit didn't take" with no trail.
    console.warn(
      `[media] buildBeanCoverPatch: ${raw.length} submitted field(s) yielded no image — write skipped, stored cover unchanged`,
    );
    return { dirty: false };
  }

  return canonical(stored) === canonical(next) ? { dirty: false } : { dirty: true, cover: next };
}
