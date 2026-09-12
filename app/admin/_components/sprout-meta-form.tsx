import { textPart, type Sprout } from "@/lib/data";
import { editSproutMetaAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * A sprout's identity: what it is called and what it is in one line.
 *
 * `PlantMetaForm`'s shape exactly — a server component posting to a server
 * action with the field names `buildSproutMetaPatch` reads — and it is handed
 * to `sprout-hero.tsx` as a prop rather than imported by it. That is what keeps
 * the island free of every field name on the sprout: the overlay is the shell,
 * never the write path, which is the line `overlay-sheet.tsx` already draws for
 * every consumer.
 *
 * `slug` is a read-only line rather than an input, for `PlantMetaForm`'s
 * reason: it is what every `parents[]` ref points at and what a promoted seed's
 * `promotedTo` records, so renaming it here would orphan things with no cascade
 * to catch it. It is shown at all because the overlay is where identity is
 * read, and the page's old `slug` / `bean` list has nowhere else to go.
 *
 * No hidden carry-along field, unlike `PlantMetaForm`'s `status`. That one is
 * load-bearing because `buildPlantMetaPatch` reads an absent status as
 * `active`; `buildSproutMetaPatch` names two fields and `updateSproutMeta`
 * writes the same two, so there is nothing a missing input could default.
 */
export function SproutMetaForm({ sprout }: { sprout: Sprout }) {
  return (
    <form action={editSproutMetaAction} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={sprout.slug} />

      <p className="font-heading text-xs text-muted-foreground">
        <span className="text-muted-foreground/70">slug</span> {sprout.slug}
      </p>

      {/* Prefills use the STRICT textPart — resolveText's fallback would copy
          the fr half into the en box and save it back as en, which is the trap
          the plant's Meta and Role forms both carry a comment about. No
          `required` on the en inputs: an fr-only name is valid (B1) and the
          pair is validated as a whole server-side. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" type="text" name="name" defaultValue={textPart(sprout.name, "en")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nameFr">Name (fr)</Label>
          <Input id="nameFr" type="text" name="nameFr" defaultValue={textPart(sprout.name, "fr")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={textPart(sprout.description, "en")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="descriptionFr">Description (fr)</Label>
          <Textarea
            id="descriptionFr"
            name="descriptionFr"
            defaultValue={textPart(sprout.description, "fr")}
          />
        </div>
      </div>

      <div className="flex justify-center">
        <Button type="submit">Save meta</Button>
      </div>
    </form>
  );
}
