import { textPart, type Bean } from "@/lib/data";
import { editBeanKeywordAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The one word a phone cover wears.
 *
 * An ordinary metadata form: zero client JS, a real submit button, works
 * without script. That is still what every admin form but the six exceptions
 * is, and this one has no reason to join them — it is two text inputs.
 *
 * Prefills use the STRICT textPart, never resolveText. The fallback would copy
 * the fr half into the en box and save it back as en, which is the trap
 * plant-meta-form.tsx documents. No `required` on the en input: an fr-only
 * keyword is valid (B1), and both blank MEANS clear.
 */
export function BeanKeywordForm({ bean }: { bean: Bean }) {
  return (
    <form action={editBeanKeywordAction} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={bean.slug} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="keyword">Keyword</Label>
          <Input
            id="keyword"
            type="text"
            name="keyword"
            placeholder="one word — Timeline, Karma"
            defaultValue={textPart(bean.keyword, "en")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="keywordFr">Keyword (fr)</Label>
          <Input
            id="keywordFr"
            type="text"
            name="keywordFr"
            defaultValue={textPart(bean.keyword, "fr")}
          />
        </div>
      </div>
      <div>
        <Button type="submit">Save keyword</Button>
      </div>
    </form>
  );
}
