import type { Sprout } from "@/lib/data";
import { editSproutMediaAction } from "../actions";
import { MediaPicker } from "@/components/admin/media-picker";

/**
 * A sprout's media, as the rail's Media panel.
 *
 * It is the case `bean-cover-form.tsx` and `plant-logo-form.tsx` both cite as
 * their precedent, and it spent that whole time inline in a page — so it is the
 * one of the three that could not be pinned. Extracted now because the rail is
 * where it lives: `RAIL_PANELS` in `lib/entity-rail-source.test.ts` holds every
 * panel to being a server component, and a panel composed inline in the page is
 * outside that list by construction. This is the panel where being outside it
 * costs the most — `editSproutMediaAction` replaces the whole list, so the
 * failure mode is not a bad save but a silent clear-all.
 *
 * Its own form — not the content form, not the meta form — which is what keeps
 * each surface's blast radius to its own fields.
 *
 * `submitLabel`, so the button is rendered BY the island: this form's entire
 * meaningful content is the picker, and a server-rendered button would let a
 * browser post a form carrying nothing. An empty media list is
 * indistinguishable from a deliberate clear-all, so that post would delete
 * every stored image. `buildMediaPatch` refuses the same payload server-side
 * via `__ready`, for the POST that never rendered a button at all;
 * `lib/media-picker-mount.test.ts` pins the script-off half.
 */
export function SproutMediaForm({ sprout }: { sprout: Sprout }) {
  return (
    <form action={editSproutMediaAction} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={sprout.slug} />

      {/* Order is load-bearing and its consequence is invisible from here: the
          first image becomes the bean's public cover. Saying so on screen, not
          only in a comment, is the difference between an authoring act and an
          accident. */}
      <p className="text-xs text-muted-foreground">
        The first image becomes this bean&apos;s cover.
      </p>

      {/* The key re-seeds the island after a save, for the reason
          plant-logo-form.tsx gives: MediaPicker reads `initial` ONCE, in its
          useState initializer, so without this React reconciles the same
          instance after the action redirects and the picker keeps showing its
          own local state — including a just-added link still carrying
          provider:"" where the server has since derived the real one. */}
      <MediaPicker
        key={JSON.stringify(sprout.media ?? [])}
        name="media"
        initial={sprout.media ?? []}
        links
        submitLabel="Save media"
      />
    </form>
  );
}
