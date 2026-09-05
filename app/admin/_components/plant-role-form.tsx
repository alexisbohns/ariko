import { textPart, type Plant } from "@/lib/data";
import { PLANT_ROLE_KINDS } from "@/lib/plant-role";
import { editPlantRoleAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-controls";

/**
 * What Alexis is to this plant.
 *
 * Was the Role *card*; it is now the body of the overlay the header's crown
 * opens, through the popover that summarizes the role first. Same server
 * action, same field names, same narrow write — this one can only ever reach
 * `role`.
 *
 * Shown publicly, and there is no private role: if the plant is public,
 * everything on this form is too, detail included. The popover that leads here
 * says so rather than this form, so the sheet stays bare.
 */
export function PlantRoleForm({ plant }: { plant: Plant }) {
  return (
    <form action={editPlantRoleAction} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={plant.slug} />

      <div className="flex flex-col gap-2 sm:max-w-56">
        <Label htmlFor="kind">Kind</Label>
        <NativeSelect id="kind" name="kind" defaultValue={plant.role.kind}>
          {PLANT_ROLE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </NativeSelect>
      </div>

      {/* Prefills use the STRICT textPart — resolveText's fallback would
          copy the fr half into the en box and save it back as en, which is
          the same trap the sprout metadata form warns about. No `required`
          on either pair: both fields are optional as a whole, and an
          fr-only title is valid (B1). */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            type="text"
            name="title"
            placeholder="Head of Product"
            defaultValue={textPart(plant.role.title, "en")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="titleFr">Title (fr)</Label>
          <Input
            id="titleFr"
            type="text"
            name="titleFr"
            defaultValue={textPart(plant.role.title, "fr")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="detail">Detail</Label>
          <Input
            id="detail"
            type="text"
            name="detail"
            defaultValue={textPart(plant.role.detail, "en")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="detailFr">Detail (fr)</Label>
          <Input
            id="detailFr"
            type="text"
            name="detailFr"
            defaultValue={textPart(plant.role.detail, "fr")}
          />
        </div>
      </div>

      <div className="flex justify-center">
        <Button type="submit">Save role</Button>
      </div>
    </form>
  );
}
