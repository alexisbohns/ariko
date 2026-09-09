import type { MediaImage } from "./data";
import { parseMediaField } from "./media-input";

/** The slice of a Screen this module cares about. `image` is REQUIRED on the
 *  stored type; it is optional here only so the create path can ask the same
 *  question of a record that does not exist yet. */
export interface ImageOwner {
  image?: MediaImage;
}

export type ScreenImagePatchResult = { dirty: false } | { dirty: true; image: MediaImage };

/** What the picker's `image` field actually carried. Shared with
 *  lib/screen-create.ts so the create path and the replace path read the wire
 *  in exactly one place — the two must agree about the marker or a create could
 *  succeed where a replace refuses. */
export function readImageField(form: FormData): {
  ready: boolean;
  submitted: number;
  image: MediaImage | null;
} {
  const raw = form.getAll("image").map((v) => String(v));
  return {
    ready: form.has("image__ready"),
    submitted: raw.length,
    // A screen is an image. An embed is not a candidate, and `links` is off on
    // the picker — but that is the UI saying so, not the contract.
    image: parseMediaField(raw).find((m): m is MediaImage => m.kind === "image") ?? null,
  };
}

// Field-order-sensitive, for lib/plant-logo.ts's reason: a stored entry comes
// back from Mongo and a submitted one is rebuilt by the browser, so key order
// differs and JSON.stringify of the object itself would call an untouched image
// dirty. width/height are IN the tuple and that is load-bearing rather than
// complete: lib/bean-cover.ts decides the phone treatment from `height > width`,
// so a re-upload that changed only the dimensions is a real edit. It will read
// THIS image once covers become refs (#73) — today it reads `Bean.cover` — which
// is why the dimensions are pinned before there is a reader for them.
//
// `alt` is in the tuple for the reason the three siblings pin it: this form runs
// the picker in full mode, so it renders the alt-text field and an alt-only save
// is reachable through the UI.
function canonical(image: MediaImage | null): string {
  return image === null
    ? "null"
    : JSON.stringify([
        image.storageKey,
        image.url,
        image.alt ?? "",
        image.width ?? null,
        image.height ?? null,
      ]);
}

/**
 * Pure, aside from one diagnostic warning. The FOURTH sibling of
 * lib/media-edit.ts (buildMediaPatch), lib/plant-logo.ts (buildPlantLogoPatch)
 * and lib/bean-cover-edit.ts (buildBeanCoverPatch) — the same `__ready` guard,
 * the same dirty gate, the same failed-save discriminator over a different
 * field. Fix the `__ready` guard, the dirty gate or the failed-save
 * discriminator here and check whether it applies there too.
 *
 * It adds one rule none of them has, and the difference is in the TYPE rather
 * than in taste:
 *
 *   A CLEAR IS NOT EXPRESSIBLE. `Screen.image` is required — a screen with no
 *   image is not a screen, it is a caption with a slug. So where
 *   buildBeanCoverPatch reads "the marker arrived and zero entries came with
 *   it" as a deliberate clear-all, this reads it as nothing to do.
 *
 * That collapses two of the sibling's branches into one: whether the payload
 * was emptied on purpose or mangled on the way, the answer here is the same and
 * the stored image survives.
 *
 * It also drops the siblings' `stored !== null` arm, and that is a deletion
 * rather than an omission: they need it because a submitted-but-unparseable
 * payload over an ALREADY EMPTY field is a no-op worth staying quiet about,
 * while a stored screen always HAS an image (`Screen.image` is required), so
 * the arm can never be false for any record this form edits. Only the warning's
 * condition survives it — `submitted > 0`.
 */
export function buildScreenImagePatch(current: ImageOwner, form: FormData): ScreenImagePatchResult {
  const { ready, submitted, image } = readImageField(form);
  const stored = current.image ?? null;

  // The picker never mounted (script off, or a submit that beat hydration), so
  // this form does not know what the screen holds. Defence in depth rather than
  // the sole protection: the card's submit button lives INSIDE the island
  // (MediaPicker's `submitLabel`), so an unmounted picker leaves no button to
  // press. This covers what a missing button cannot — a replayed POST.
  if (!ready) return { dirty: false };

  if (image === null) {
    // The one diagnostic in this otherwise pure module, for buildMediaPatch's
    // reason: without it, a client bug here is indistinguishable from an
    // ordinary no-op save — no exception, no log, the redirect proceeds — and
    // the author just sees "my edit didn't take" with no trail.
    if (submitted > 0) {
      console.warn(
        `[media] buildScreenImagePatch: ${submitted} submitted field(s) yielded no image — write skipped, stored image unchanged`,
      );
    }
    return { dirty: false };
  }

  return canonical(stored) === canonical(image) ? { dirty: false } : { dirty: true, image };
}
