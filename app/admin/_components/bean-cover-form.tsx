import type { Bean } from "@/lib/data";
import { editBeanCoverAction } from "../actions";
import { MediaPicker } from "@/components/admin/media-picker";

/**
 * The bean's cover art.
 *
 * The sprout media card's case and the plant Logo card's case again, not a new
 * one: the form is nothing BUT the picker, so the picker renders the submit
 * button (`submitLabel`) and a script-off browser sees no button at all — inert
 * rather than destructive, which is CLAUDE.md's rule verbatim.
 * buildBeanCoverPatch enforces the same thing server-side for a POST that never
 * rendered a button.
 *
 * The keyword lives in its OWN form next door. Adding its input here would put a
 * lone text field in a button-less form, which submits on Enter — and that
 * payload carries no cover__ready marker, so the cover survives but the keyword
 * vanishes with nothing on screen to say so.
 *
 * A cover is cropped to a phone's proportions (`cloudinaryThumb(..., { width:
 * 224, height: 484 })` in components/bean-cover.tsx, resolving through
 * `c_fill` in lib/image-url.ts — lib/bean-cover.ts only picks the phone
 * branch via `isPortrait`, it does no cropping itself): upload a roughly
 * 9:19.5 capture, not a wider portrait screenshot, or Cloudinary's hard crop
 * will take more than intended.
 */
export function BeanCoverForm({ bean }: { bean: Bean }) {
  return (
    <form action={editBeanCoverAction} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={bean.slug} />
      {/* The key re-seeds the island after a save, for the reason
          plant-logo-form.tsx gives: MediaPicker reads `initial` ONCE, in its
          useState initializer, so without this React reconciles the same
          instance after the action redirects and the picker keeps showing its
          own local state rather than what the database now holds.
          `links` is omitted — a cover is an image, never an embed. */}
      <MediaPicker
        key={JSON.stringify(bean.cover ?? null)}
        name="cover"
        initial={bean.cover ? [bean.cover] : []}
        max={1}
        submitLabel="Save cover"
      />
    </form>
  );
}
