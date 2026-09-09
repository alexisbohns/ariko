import { PLANT_PREFIX, parentsWithPrefix, type Screen } from "@/lib/data";
import { toggleScreenExhibitAction } from "../actions";
import { Button } from "@/components/ui/button";
import { FilterFields } from "./filter-fields";

/**
 * Whether this screen is on its plant's strip — one button, and the half of
 * the exhibition that works without script.
 *
 * An ORDINARY admin metadata form: native controls, a real submit, zero client
 * JS. The other half — the SEQUENCE — lives in a popover on the plant page,
 * because a 256px panel can hold a strip of eight and cannot hold a library of
 * a hundred and seventy to pick from. That split is deliberate and it is what
 * makes the script-off cost one sentence long: without script the author can
 * still add and withdraw, here, and only the ordering is out of reach.
 *
 * Separate from the Details form next door for the reason every card on this
 * page is separate from its neighbour (the bean Keyword form states it at
 * length): one form, one act, so a save can never carry a field the author did
 * not mean to touch.
 *
 * A screen with no plant parent gets a sentence instead of a button. There is
 * no exhibition for it to join, and a button that could only fail is worse
 * than none — `applyExhibition` refuses the same case server-side, which is
 * the defence-in-depth stance `buildScreenImagePatch`'s `__ready` check takes.
 */
export function ScreenExhibitForm({
  screen,
  plantName,
  query,
}: {
  screen: Screen;
  /** The containing plant's readable name, resolved by the page. */
  plantName: string | null;
  query: string;
}) {
  const plant = parentsWithPrefix(screen.parents, PLANT_PREFIX)[0] ?? null;
  const exhibited = screen.exhibited === true;

  if (!plant) {
    return (
      <p className="text-sm text-muted-foreground">
        This screen has no plant, so there is no exhibition for it to join. Give it one in Details
        above.
      </p>
    );
  }

  return (
    <form action={toggleScreenExhibitAction} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={screen.slug} />
      <FilterFields query={query} />

      <p className="text-sm text-muted-foreground">
        {exhibited ? (
          <>
            On <span className="font-heading">{plantName ?? plant}</span>&rsquo;s page, in the strip
            above the narrative. Its position is set from the plant&rsquo;s Exhibition panel.
          </>
        ) : (
          <>
            Stored, and on no page. Adding it to{" "}
            <span className="font-heading">{plantName ?? plant}</span>&rsquo;s strip publishes this
            screen; withdrawing it makes it private again.
          </>
        )}
      </p>

      <div>
        {/* The op is a NAMED member of lib/exhibition.ts's vocabulary, carried
            on the button rather than in a hidden field, so the form has exactly
            one meaning at a time. The action re-validates it regardless. */}
        <Button type="submit" name="op" value={exhibited ? "remove" : "add"} variant={exhibited ? "outline" : "default"}>
          {exhibited ? "Remove from the exhibition" : `Add to ${plantName ?? plant}'s exhibition`}
        </Button>
      </div>
    </form>
  );
}
