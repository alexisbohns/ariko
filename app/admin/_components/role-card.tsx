import { textPart, type Plant } from "@/lib/data";
import { PLANT_ROLE_KINDS, roleParts } from "@/lib/plant-role";
import { editPlantRoleAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-controls";

/**
 * What Alexis is to this plant. A metadata form, so it is zero-client-JS: a
 * native select and plain inputs posting to a server action (CLAUDE.md).
 *
 * Its own form and its own action, separate from the narrative ContentCard on
 * the same page — which is what keeps each write narrow. This one can only ever
 * reach `role`.
 */
export function RoleCard({ plant }: { plant: Plant }) {
  const { label, title } = roleParts(plant.role);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base tracking-tight">Role</CardTitle>
        {/* Said on the form's face, deliberately: there is no private role.
            If the plant is public, everything below is too — detail included. */}
        <CardDescription>
          Shown publicly, on this plant&rsquo;s page and on the landing gallery. Currently{" "}
          <span className="text-foreground">{title ? `${label} · ${title}` : label}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={editPlantRoleAction} className="flex flex-col gap-4">
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

          <div>
            <Button type="submit">Save role</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
