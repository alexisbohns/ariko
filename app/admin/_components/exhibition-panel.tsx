import { cloudinaryFit } from "@/lib/image-url";
import { reorderExhibitionAction } from "../actions";

/**
 * The strip's SEQUENCE, as the contents of a panel on the plant's right-hand
 * rail.
 *
 * A SERVER component, rendered by `app/admin/plant/[slug]/page.tsx` and handed
 * to `plant-inside.tsx` as a prop — the arrangement `plant-hero.tsx` uses for
 * `metaForm`, `roleForm` and `logoForm`, and for the same reason: the client
 * island owns the open state and nothing else, so it never composes a payload
 * and never learns a field name.
 *
 * Each row is ONE form with three submit buttons rather than three forms,
 * which is why a row needs no client code at all: `name="op"` on the button is
 * what tells the action which of the three the author pressed, and a button
 * that would do nothing is `disabled` rather than absent — a row whose ↑ came
 * and went as it moved would shift the other two under the pointer.
 *
 * `disabled` is a courtesy and not the guard. `applyExhibitionOp` returns null
 * for `up` at the head and `down` at the tail, so a crafted POST writes
 * nothing; the attribute only spares the author a page load.
 */
export interface ExhibitionPanelRow {
  slug: string;
  /** Resolved for display — a row shows words, not a Text. */
  name: string;
  url: string;
  alt: string;
}

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

            <span className="flex shrink-0 items-center gap-0.5">
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
              <PanelButton op="remove" label={`Remove ${row.name} from the exhibition`}>
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
