import { resolveText, type Sprout } from "@/lib/data";
import { deleteSproutAction } from "../actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChoiceLabel, NativeCheckbox } from "@/components/ui/native-controls";

/**
 * The delete, extracted from the page's Danger zone card and moved onto the
 * rail.
 *
 * A server component, handed to `EntityRail` as a panel's `ReactNode` — which
 * is the arrangement that keeps the rail unable to compose this particular
 * payload. Of everything on that rail this is the one that cannot be undone.
 * `lib/entity-rail-source.test.ts` pins both halves: the island imports no
 * action, and this file carries no `"use client"`.
 *
 * The confirm checkbox is `required` for the browser and re-checked in
 * `deleteSproutAction` for everything else: a POST that never rendered the box
 * has to be refused too. The rejection redirects with `form=delete`, so the
 * rail reopens onto this panel and the message appears where the checkbox is.
 *
 * That re-check gates on the literal string `"on"`, which is what a browser
 * posts for a checked checkbox carrying no `value` — so the ABSENT `value`
 * attribute below is load-bearing, and giving the box one silently blocks
 * every delete. The failure reads as a bug in the checkbox rather than in the
 * markup: `tsc`, `eslint` and the suite stay green, and the author sees "could
 * not delete: confirm the permanent deletion first" with the box visibly
 * ticked. `screen-delete-form.tsx` records the same trap inline.
 */
export function SproutDeleteForm({ sprout, error }: { sprout: Sprout; error?: string }) {
  // A literal id, not `useId`: this is a server component, and a page carries
  // exactly one delete panel. It exists so the rejection below is part of the
  // checkbox's description rather than only next to it — `role="alert"` is a
  // live region, and a message already present when the region first renders
  // is generally not announced. A rejected delete arrives by full navigation
  // with the panel already open, so without this a reader tabbing to the box
  // hears its label and nothing about why the last attempt failed.
  const errorId = "sprout-delete-error";

  return (
    <form action={deleteSproutAction} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={sprout.slug} />

      {error ? (
        <Alert id={errorId} variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <ChoiceLabel className="items-start leading-normal">
        <NativeCheckbox
          name="confirm"
          required
          className="mt-0.5"
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
        />
        <span>
          Yes, permanently delete the sprout “{resolveText(sprout.name)}” — this cannot be
          undone.
        </span>
      </ChoiceLabel>

      <div>
        <Button type="submit" variant="destructive">
          Delete sprout
        </Button>
      </div>
    </form>
  );
}
