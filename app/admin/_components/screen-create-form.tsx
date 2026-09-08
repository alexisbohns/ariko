import type { Plant } from "@/lib/data";
import { createScreenAction } from "../actions";
import { MediaPicker } from "@/components/admin/media-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EntitySelect } from "./entity-select";
import { FilterFields } from "./filter-fields";

/**
 * A new screen: a slug, a name, a plant and an image.
 *
 * The ONE form in the admin that holds the media picker alongside text inputs,
 * and that is a decision rather than a slip. The picker's two rules — inert
 * rather than destructive, and no edit ever depending on the island — are about
 * forms that change a record that already exists. Script-off this form renders
 * its fields, renders no button (the button is inside the island), and creates
 * nothing. Nothing is lost, because nothing existed.
 *
 * TWO text inputs rather than one is load-bearing: a lone text input in a
 * button-less form submits on Enter, which is the trap the bean Keyword form
 * documents. With two there is no implicit submission at all — and
 * buildNewScreenInput refuses a payload with no `image__ready` regardless.
 *
 * The name may be left blank: it falls back to the slug through
 * `screenNameFromStem`, the same derivation the import's hundred and seventy
 * names came from, so a screen added by hand is named by the same rule.
 */
export function ScreenCreateForm({ plants, query }: { plants: Plant[]; query: string }) {
  return (
    <form action={createScreenAction} className="flex flex-col gap-5">
      <FilterFields query={query} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            type="text"
            name="slug"
            placeholder="match-hero-m104"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" type="text" name="name" placeholder="from the slug when blank" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="plant">Plant</Label>
        {/* The Meta form's select, so a plant is named and ordered identically
            on both sides of a screen's life. `current=""` — nothing is stored
            yet, so its orphan branch simply never fires here. */}
        <EntitySelect id="plant" name="plant" current="" entities={plants} />
      </div>

      <MediaPicker name="image" max={1} submitLabel="Create screen" />
    </form>
  );
}
