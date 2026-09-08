import type { Screen } from "@/lib/data";
import { editScreenImageAction } from "../actions";
import { MediaPicker } from "@/components/admin/media-picker";
import { FilterFields } from "./filter-fields";

/**
 * The screen itself.
 *
 * The sprout media card's case, the plant Logo card's and the bean Cover
 * card's, a fourth time and not a new one: the form is nothing BUT the picker,
 * so the picker renders the submit button (`submitLabel`) and a script-off
 * browser sees no button at all — inert rather than destructive, which is
 * CLAUDE.md's rule verbatim. buildScreenImagePatch enforces the same thing
 * server-side for a POST that never rendered a button.
 *
 * What differs from those three: this one cannot CLEAR. `Screen.image` is
 * required, so an emptied picker writes nothing rather than unsetting the
 * field — see lib/screen-image.ts.
 */
export function ScreenImageForm({ screen, query }: { screen: Screen; query: string }) {
  return (
    <form action={editScreenImageAction} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={screen.slug} />
      <FilterFields query={query} />
      {/* The key re-seeds the island after a save, for plant-logo-form.tsx's
          reason: MediaPicker reads `initial` ONCE, in its useState initializer,
          so without this React reconciles the same instance after the action
          redirects and the picker keeps showing its own local state rather than
          what the database now holds. `links` is omitted — a screen is an
          image, never an embed. */}
      <MediaPicker
        key={JSON.stringify(screen.image)}
        name="image"
        initial={[screen.image]}
        max={1}
        submitLabel="Save image"
      />
    </form>
  );
}
