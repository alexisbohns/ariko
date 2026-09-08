import { resolveText, textPart, type Plant, type Bean, type Screen } from "@/lib/data";
import { editScreenMetaAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-controls";
import { FilterFields } from "./filter-fields";

/**
 * A screen's identity: what it is called, what it says, where it sits, and what
 * it shows.
 *
 * An ORDINARY admin metadata form — zero client JS, native controls, a real
 * submit button, works with no script. That is still what every admin form but
 * the six documented exceptions is, and this one has no reason to join them.
 *
 * Separate from the Image card next door, and separate for the reason the bean
 * Keyword form documents: put a text input inside the picker's form and
 * script-off that form renders no button (the button is inside the island) but
 * DOES render the input — and a lone text input in a button-less form submits
 * on Enter, posting a payload with no `image__ready`. Two forms make that
 * impossible rather than survivable.
 *
 * Prefills use the STRICT `textPart`, never `resolveText`: the fallback would
 * copy the fr half into the en box and save it back as en, which is the trap
 * `plant-meta-form.tsx` documents. No `required` on the en inputs — an fr-only
 * name is valid, and the pair is validated as a whole server-side.
 */
export function ScreenMetaForm({
  screen,
  plants,
  beans,
  query,
}: {
  screen: Screen;
  plants: Plant[];
  beans: Bean[];
  query: string;
}) {
  const plant = (screen.parents ?? []).find((p) => p.startsWith("plant:"))?.slice("plant:".length) ?? "";
  const bean =
    (screen.relations ?? []).find((r) => r.kind === "shows" && r.ref.startsWith("bean:"))?.ref.slice("bean:".length) ??
    "";

  return (
    <form action={editScreenMetaAction} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={screen.slug} />
      <FilterFields query={query} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" type="text" name="name" defaultValue={textPart(screen.name, "en")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nameFr">Name (fr)</Label>
          <Input id="nameFr" type="text" name="nameFr" defaultValue={textPart(screen.name, "fr")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="legend">Legend</Label>
          <Input
            id="legend"
            type="text"
            name="legend"
            placeholder="the caption, when this screen earns one"
            defaultValue={textPart(screen.legend, "en")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="legendFr">Legend (fr)</Label>
          <Input id="legendFr" type="text" name="legendFr" defaultValue={textPart(screen.legend, "fr")} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tags">Tags</Label>
        <Input
          id="tags"
          type="text"
          name="tags"
          placeholder="comma separated"
          defaultValue={(screen.tags ?? []).join(", ")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          {/* Containment. The import set it and nothing else could change it,
              so a mis-parented screen had no way back — which is why this
              select exists even though the issue's field list did not name it. */}
          <Label htmlFor="plant">Plant</Label>
          <NativeSelect id="plant" name="plant" defaultValue={plant}>
            <option value="">— none —</option>
            {plants.map((p) => (
              <option key={p.slug} value={p.slug}>
                {resolveText(p.name)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          {/* Writes at most ONE `shows` relation. Every other kind the screen
              carries is passed through untouched by buildScreenMetaPatch —
              including the `{ kind: "cover" }` the import wrote on the eight
              screens the landing row uses, which is the mapping the
              covers-become-refs slice depends on. */}
          <Label htmlFor="bean">Shows</Label>
          <NativeSelect id="bean" name="bean" defaultValue={bean}>
            <option value="">— none —</option>
            {beans.map((b) => (
              <option key={b.slug} value={b.slug}>
                {resolveText(b.name)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}
