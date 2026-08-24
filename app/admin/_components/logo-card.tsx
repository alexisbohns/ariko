import type { Plant } from "@/lib/data";
import { editPlantLogoAction } from "../actions";
import { MediaPicker } from "@/components/admin/media-picker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The plant's mark. The one client-island write on this page, and separate
 * from the Meta card by necessity rather than taste: the Meta card is
 * zero-client-JS and the picker is an island, so merging them would make a
 * metadata form depend on script.
 *
 * This is the sprout media card's case, not a third exception to CLAUDE.md.
 * The form is nothing BUT the picker, so the picker renders the submit button
 * (`submitLabel`) and a script-off browser sees no button at all — the card is
 * inert rather than destructive, which is precisely what the rule asks for.
 * buildPlantLogoPatch enforces the same thing server-side, for a POST that
 * never rendered a button.
 */
export function LogoCard({ plant }: { plant: Plant }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base tracking-tight">Logo</CardTitle>
        <CardDescription className="text-xs">
          Shown as a rounded square above this plant&rsquo;s name on the landing gallery. A square
          image reads best; anything else is cropped to one.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
