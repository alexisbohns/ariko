import { cloudinaryFit } from "@/lib/image-url";
import { reorderExhibitionAction } from "../actions";

export interface ExhibitionPanelRow {
  slug: string;
  /** Resolved for display — a row shows words, not a Text. */
  name: string;
  url: string;
  alt: string;
}

/**
 * The strip's SEQUENCE, as the contents of a panel on the plant's right-hand
 * rail.
 *
 * A SERVER component, rendered by `app/admin/plant/[slug]/page.tsx` and handed
 * to `plant-rail.tsx` as a prop — the arrangement `plant-hero.tsx` uses for
 * `metaForm`, `roleForm` and `logoForm`, and for the same reason: the client
 * island owns the open state and nothing else, so it never composes a payload
 * and never learns a field name.
 *
 * Each row is ONE form with three submit buttons rather than three forms,
 * which is why a row needs no client code at all: `name="op"` on the button is
 * what tells the action which of the three the author pressed, and a button
 * that would do nothing is `disabled` rather than absent — not because a
 * vanishing ↑ would shift its neighbours out from under the pointer (the ROW
 * moves regardless: a mouse chases it down the list either way, and a focused
 * button that goes `disabled` is blurred by the browser, dropping a keyboard
 * user's focus at the exact moment the item lands) but because a stable
 * three-button group is easier to aim at than one whose arity changes
 * underfoot.
 *
 * `disabled` is a courtesy and not the guard. `applyExhibitionOp` returns null
 * for `up` at the head and `down` at the tail, so a crafted POST writes
 * nothing; the attribute only spares the author a page load.
 *
 * The empty state below is reachable BECAUSE the two gates that decide whether
 * this component renders at all differ from the one it checks itself: the page
 * hands `plant-rail.tsx` an `exhibition` prop when the plant has ANY
 * screens, and this component falls to the empty branch when none of THOSE are
 * EXHIBITED — a plant can have screens in the library and nothing on its page.
 */
export function ExhibitionPanel({
  plantSlug,
  rows,
}: {
  plantSlug: string;
  rows: ExhibitionPanelRow[];
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing exhibited yet. Add screens from{" "}
        <a
          href={`/admin/screens?plant=${encodeURIComponent(plantSlug)}`}
          className="underline underline-offset-4 transition-colors hover:text-foreground"
        >
          the library
        </a>
        .
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-1">
      {rows.map((row, index) => (
        <li key={row.slug}>
          <form action={reorderExhibitionAction} className="flex items-center gap-2">
            <input type="hidden" name="slug" value={row.slug} />

            {/* object-contain for the contact sheet's reason: a 9:19.5 capture
                cropped into a box is a picture of its middle third, and the
                thumbnail is here to be recognised. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cloudinaryFit(row.url, { width: 96 })}
              alt={row.alt}
              loading="lazy"
              decoding="async"
              className="h-12 w-8 shrink-0 rounded border bg-muted/40 object-contain"
            />

            <a
              href={`/admin/screens/${encodeURIComponent(row.slug)}`}
              className="min-w-0 flex-1 truncate text-sm underline-offset-4 hover:underline"
            >
              {row.name}
            </a>

            <span className="flex shrink-0 items-center gap-2">
              <span className="flex items-center gap-0.5">
                <PanelButton op="up" label={`Move ${row.name} up`} disabled={index === 0}>
                  ↑
                </PanelButton>
                <PanelButton
                  op="down"
                  label={`Move ${row.name} down`}
                  disabled={index === rows.length - 1}
                >
                  ↓
                </PanelButton>
              </span>

              {/* The one destructive op of the three, and the only one whose
                  undo does not restore what it undid: `writeExhibition`'s
                  withdraw half sets `visibility: "private"` and unsets both
                  gallery fields, the identical write
                  `screen-exhibit-form.tsx` spells out in a full sentence — "it
                  becomes private again" — because a bare "remove" hides that
                  second effect. Re-adding it does not put it back where it
                  was either: `exhibitionWrites` maps a re-added slug to
                  `undefined`, which differs from every stored index, so it is
                  always promoted at the TAIL. A real gap (this span's `gap-2`,
                  not the arrows' `gap-0.5`) separates it from ↓ so a stray
                  press cannot land on it — it is not one of the pair. */}
              <PanelButton
                op="remove"
                label={`Withdraw ${row.name} from the exhibition — it becomes private again`}
              >
                ✕
              </PanelButton>
            </span>
          </form>
        </li>
      ))}
    </ol>
  );
}

/**
 * One of the three. An `aria-hidden` glyph beside an `sr-only` word, which is
 * `components/admin/glyphs.tsx`'s shape and the screen library's "+": the name
 * is real text in the document rather than an attribute on it, so an arrow is
 * never the only carrier of what it does.
 *
 * No lucide, and not for the public zone's reason — this is the admin, which
 * imports lucide everywhere. Three arrows at 12px in a 256px panel are two
 * characters of text, and a component for each would be three imports to draw
 * what the font already has.
 */
function PanelButton({
  op,
  label,
  disabled,
  children,
}: {
  op: "up" | "down" | "remove";
  label: string;
  disabled?: boolean;
  children: string;
}) {
  return (
    <button
      type="submit"
      name="op"
      value={op}
      disabled={disabled}
      className="flex size-6 items-center justify-center rounded-md text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
    >
      <span aria-hidden>{children}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
