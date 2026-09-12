import type { Screen } from "@/lib/data";
import { deleteScreenAction } from "../actions";
import { Button } from "@/components/ui/button";
import { ChoiceLabel, NativeCheckbox } from "@/components/ui/native-controls";
import { FilterFields } from "./filter-fields";

/**
 * The one irreversible act in the library — `deleteSproutAction`'s shape, down
 * to the confirm checkbox the action re-checks server-side because the
 * browser's `required` is only UX.
 *
 * The DOCUMENT goes; the Cloudinary asset stays. That is stated on the card
 * rather than left to be reasoned about, because until covers become screen
 * references a bean's cover holds its own inline copy of the same asset — so
 * deleting the bytes here would break the landing row, and an unreferenced
 * asset is `npm run check:orphans`'s to sweep.
 */
export function ScreenDeleteForm({
  screen,
  isCover,
  query,
}: {
  screen: Screen;
  isCover: boolean;
  query: string;
}) {
  return (
    <form action={deleteScreenAction} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={screen.slug} />
      <FilterFields query={query} />

      {isCover ? (
        <p className="text-sm text-muted-foreground">
          This screen is a bean&rsquo;s cover. The cover holds its own copy of the image, so it
          keeps working — but the library loses the record of which image that is.
        </p>
      ) : null}

      <ChoiceLabel htmlFor="confirm" className="items-start gap-2.5">
        {/* No `value` attribute, deliberately: the action gates on the string
            "on", which is the browser's default for a valueless checked
            checkbox. Giving it one silently blocks every delete. */}
        <NativeCheckbox id="confirm" name="confirm" required className="mt-0.5" />
        <span className="text-sm">
          Yes, permanently delete this screen. The stored image is not deleted.
        </span>
      </ChoiceLabel>

      <div>
        <Button type="submit" variant="destructive">
          Delete screen
        </Button>
      </div>
    </form>
  );
}
