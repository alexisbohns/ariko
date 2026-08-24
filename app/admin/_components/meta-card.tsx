import { textPart, type Plant } from "@/lib/data";
import { PLANT_STATUSES, statusOf } from "@/lib/plant-status";
import { editPlantMetaAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-controls";

/**
 * The plant's identity: what it is called, what it is in one line, and whether
 * it is still being worked on. Until this card there was no way to edit any of
 * the three outside MongoDB.
 *
 * A metadata form, so it is zero-client-JS: plain inputs and a native select
 * posting to a server action (CLAUDE.md). Its own form and its own action,
 * separate from the Role card and the narrative ContentCard on the same page —
 * which is what keeps each write narrow. This one can only ever reach `name`,
 * `description` and `status`.
 *
 * `slug` is deliberately not a field. It is what every pod's and bean's
 * `parents[]` points at, so renaming it here would orphan everything beneath
 * the plant with no cascade to catch it.
 */
export function MetaCard({ plant }: { plant: Plant }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base tracking-tight">Meta</CardTitle>
        {/* Status is the one field here whose effect is invisible from this
            page, so the card says what it does. */}
        <CardDescription>
          An inactive plant still shows publicly — it moves under the{" "}
          <span className="text-foreground">Inactive</span> heading on the landing gallery, at full
          contrast. To hide a plant entirely, unpublish it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={editPlantMetaAction} className="flex flex-col gap-4">
          <input type="hidden" name="slug" value={plant.slug} />

          {/* Prefills use the STRICT textPart — resolveText's fallback would
              copy the fr half into the en box and save it back as en, which is
              the trap the Role card documents. No `required` on the en input:
              an fr-only name is valid (B1), and the pair is validated as a
              whole server-side. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" type="text" name="name" defaultValue={textPart(plant.name, "en")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nameFr">Name (fr)</Label>
              <Input
                id="nameFr"
                type="text"
                name="nameFr"
                defaultValue={textPart(plant.name, "fr")}
              />
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

          <div className="flex flex-col gap-2 sm:max-w-56">
            <Label htmlFor="status">Status</Label>
            {/* statusOf, not `plant.status`: an unmarked plant must open with
                "active" selected rather than with a blank select whose first
                save would look like a change. */}
            <NativeSelect id="status" name="status" defaultValue={statusOf(plant)}>
              {PLANT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div>
            <Button type="submit">Save meta</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
