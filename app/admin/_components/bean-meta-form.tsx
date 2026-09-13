import { textPart, type Bean } from "@/lib/data";
import { editBeanMetaAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The bean's identity: what it is called and what it is in one line.
 *
 * `plant-meta-form.tsx`'s sibling, and a SERVER component like it — the head
 * that opens it is an island, but the island is the shell, never the write
 * path. That is what keeps `bean-hero.tsx` free of every field name on the
 * bean.
 *
 * No hidden `status` input, unlike the plant's: a bean has no status, and its
 * `visibility` travels through its own one-field action rather than riding this
 * form. A name edit must not be able to publish anything.
 *
 * `slug` is deliberately not a field. It is what every sprout's `parents[]`
 * points at, so renaming it here would orphan everything beneath the bean with
 * no cascade to catch it.
 */
export function BeanMetaForm({ bean }: { bean: Bean }) {
  return (
    <form action={editBeanMetaAction} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={bean.slug} />

      {/* Prefills use the STRICT textPart — resolveText's fallback would copy
          the fr half into the en box and save it back as en, which is the trap
          the plant's Role form documents. No `required` on the en input: an
          fr-only name is valid (B1), and the pair is validated as a whole
          server-side by buildBeanMetaPatch. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" type="text" name="name" defaultValue={textPart(bean.name, "en")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nameFr">Name (fr)</Label>
          <Input id="nameFr" type="text" name="nameFr" defaultValue={textPart(bean.name, "fr")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            type="text"
            name="description"
            placeholder="one line, never markdown"
            defaultValue={textPart(bean.description, "en")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="descriptionFr">Description (fr)</Label>
          <Input
            id="descriptionFr"
            type="text"
            name="descriptionFr"
            defaultValue={textPart(bean.description, "fr")}
          />
        </div>
      </div>

      <div className="flex justify-center">
        <Button type="submit">Save meta</Button>
      </div>
    </form>
  );
}
