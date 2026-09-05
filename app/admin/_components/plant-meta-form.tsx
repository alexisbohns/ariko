import { textPart, type Plant } from "@/lib/data";
import { statusOf } from "@/lib/plant-status";
import { editPlantMetaAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The plant's identity: what it is called and what it is in one line.
 *
 * Was the Meta *card*; it is now the body of the overlay the page title opens
 * (the plant-page-pure slice). A server component still, posting to the same
 * server action with the same field names — the overlay is the shell, never
 * the write path, which is the rule the seed overlay already states.
 *
 * `slug` is deliberately not a field. It is what every pod's and bean's
 * `parents[]` points at, so renaming it here would orphan everything beneath
 * the plant with no cascade to catch it.
 *
 * `status` is not a field EITHER any more — the header's zap owns it, through
 * its own one-field action. It still rides along as a HIDDEN input carrying the
 * plant's current value, and that is load-bearing rather than tidy:
 * buildPlantMetaPatch reads an absent status as "active" (a tolerant default
 * that is right for a form which never had the field), so dropping the input
 * outright would silently reactivate an inactive plant on every name edit.
 */
export function PlantMetaForm({ plant }: { plant: Plant }) {
  return (
    <form action={editPlantMetaAction} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={plant.slug} />
      <input type="hidden" name="status" value={statusOf(plant)} />

      {/* Prefills use the STRICT textPart — resolveText's fallback would
          copy the fr half into the en box and save it back as en, which is
          the trap the Role form documents. No `required` on the en input:
          an fr-only name is valid (B1), and the pair is validated as a
          whole server-side. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" type="text" name="name" defaultValue={textPart(plant.name, "en")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nameFr">Name (fr)</Label>
          <Input id="nameFr" type="text" name="nameFr" defaultValue={textPart(plant.name, "fr")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            type="text"
            name="description"
            placeholder="one line, never markdown"
            defaultValue={textPart(plant.description, "en")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="descriptionFr">Description (fr)</Label>
          <Input
            id="descriptionFr"
            type="text"
            name="descriptionFr"
            defaultValue={textPart(plant.description, "fr")}
          />
        </div>
      </div>

      <div className="flex justify-center">
        <Button type="submit">Save meta</Button>
      </div>
    </form>
  );
}
