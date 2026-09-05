import type { Plant } from "@/lib/data";
import { editPlantLogoAction } from "../actions";
import { MediaPicker } from "@/components/admin/media-picker";

/**
 * The plant's mark. Was the Logo *card*; it is now the body of the popover the
 * header's logo opens — the mark edits itself, in place, which is why it gets a
 * popover rather than a sheet.
 *
 * This is the sprout media card's case, unchanged by the move. The form is
 * nothing BUT the picker, so the picker renders the submit button
 * (`submitLabel`) and a script-off browser sees no button at all — inert rather
 * than destructive, which is precisely what CLAUDE.md's rule asks for.
 * buildPlantLogoPatch enforces the same thing server-side, for a POST that
 * never rendered a button. (Script-off the popover never opens either, so the
 * form is not even reachable — which is the same absence, one step earlier.)
 */
export function PlantLogoForm({ plant }: { plant: Plant }) {
  return (
    <form action={editPlantLogoAction} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={plant.slug} />
      {/* The key re-seeds the island after a save, for the reason the
          sprout media card gives: MediaPicker reads `initial` ONCE, in its
          useState initializer, so without this React reconciles the same
          instance after the action redirects and the picker keeps showing
          its own local state rather than what the database now holds.
          `links` is omitted — a logo is an image, never an embed. */}
      <MediaPicker
        key={JSON.stringify(plant.logo ?? null)}
        name="logo"
        initial={plant.logo ? [plant.logo] : []}
        max={1}
        submitLabel="Save logo"
      />
    </form>
  );
}
