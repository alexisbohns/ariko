import type { Screen } from "@/lib/data";
import { toggleScreenExhibitAction } from "../actions";
import { Button } from "@/components/ui/button";
import { FilterFields } from "./filter-fields";

/**
 * The screen's plant, as this card needs it — resolved by the PAGE, not
 * re-derived here, because the page already loads `raw.plants` to look up the
 * name and this card must not repeat that lookup and risk disagreeing with it.
 *
 * Three states rather than `string | null`, and the third is load-bearing.
 * `lib/screen-edit.ts` deliberately does not validate a screen's `plant`
 * parent against the garden, and `buildDataset` only indexes an exhibition
 * strip for a plant that actually exists in it — so a screen can carry a
 * `plant:` ref that names nothing at all (deleted after the screen pointed at
 * it, or simply mistyped). Collapsing that into `found` would let this card
 * render the exhibited copy and the Add button for a plant with no page to
 * land on: a successful write with no visible effect, under confidently wrong
 * copy. Collapsing it into `none` would be equally wrong the other way — the
 * fix is not "give it a plant", it already has one named, just not a real
 * one — which is why `dangling` carries the slug rather than folding into
 * either neighbour.
 */
export type ScreenPlantRef =
  | { kind: "none" }
  | { kind: "dangling"; slug: string }
  | { kind: "found"; slug: string; name: string };

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
 * A screen whose plant parent is DANGLING gets the same treatment, for the
 * reason `ScreenPlantRef`'s docblock gives: the fix there is Details, not this
 * card, so this card offers no button either.
 */
export function ScreenExhibitForm({
  screen,
  plant,
  query,
}: {
  screen: Screen;
  plant: ScreenPlantRef;
  query: string;
}) {
  const exhibited = screen.exhibited === true;

  if (plant.kind === "none") {
    return (
      <p className="text-sm text-muted-foreground">
        This screen has no plant, so there is no exhibition for it to join. Give it one in Details
        above.
      </p>
    );
  }

  if (plant.kind === "dangling") {
    return (
      <p className="text-sm text-muted-foreground">
        This screen names <span className="font-heading">{plant.slug}</span>, which is not a plant
        in the garden — so there is no page for it to appear on, exhibited or not. Repoint it in
        Details above.
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
            On <span className="font-heading">{plant.name}</span>&rsquo;s page, in the strip above
            the narrative. Its position is set from the plant&rsquo;s Exhibition panel.
          </>
        ) : (
          <>
            Stored, and on no page. Adding it to{" "}
            <span className="font-heading">{plant.name}</span>&rsquo;s strip publishes this screen;
            withdrawing it makes it private again.
          </>
        )}
      </p>

      <div>
        {/* The op is a NAMED member of lib/exhibition.ts's vocabulary, carried
            on the button rather than in a hidden field, so the form has exactly
            one meaning at a time. The action re-validates it regardless. */}
        <Button type="submit" name="op" value={exhibited ? "remove" : "add"} variant={exhibited ? "outline" : "default"}>
          {exhibited ? "Remove from the exhibition" : `Add to ${plant.name}'s exhibition`}
        </Button>
      </div>
    </form>
  );
}
