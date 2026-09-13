import type { ReactNode } from "react";

import { initialsOf } from "@/lib/glyphs";
import { cloudinaryThumb } from "@/lib/image-url";

/**
 * A plant's head, in both zones.
 *
 * `app/(public)/_components/plant-head.tsx` and
 * `app/admin/_components/plant-hero.tsx` were built from the same drawing and
 * kept diverging from it. `SQUIRCLE = "rounded-[28%]"` was declared verbatim in
 * both. So was the `size-28` mark with its `initialsOf` fallback, and so was the
 * centred `<header>` around it. What had already drifted was the typography: the
 * admin titled its plants in Geist Mono at `text-3xl font-medium`, the public
 * page in Profane at `text-4xl`, so the author never once saw the title they
 * were shipping.
 *
 * The old note on that pair said they "share a SHAPE, not an implementation",
 * which was an accurate description of the problem rather than a reason for it.
 * This file is the shape, and the two zones fill its slots.
 *
 * **Server-safe** — no `"use client"`, no lucide — for `components/chrome.tsx`'s
 * reason: the public page is a server component and the admin's is a client
 * island, and only a file that is neither can serve both. It follows that
 * nothing here is a control. Every trigger, popover and sheet stays in the admin
 * island; what lives here is the layout and the two type tokens.
 *
 * What deliberately does NOT live here is the facts row. The public page states
 * words (`♔ Lead`, `⚡ Active`); the admin draws three ghost icon triggers. Those
 * are different registers on purpose — a word is a fact, an icon is a control —
 * so `facts` is a slot. The vocabulary BEHIND both is already shared
 * (`lib/plant-role.ts`, `lib/plant-status.ts`, `lib/glyphs.ts`), and that is the
 * part that must not drift.
 */

/**
 * The mark's box.
 *
 * The box carries the shape and nothing else — the `bg-muted` plate belongs to
 * the MONOGRAM, inside `PlantMarkContent`, not to the box around it. A ground
 * on the box fills a transparent PNG's holes with grey, which is the same bug
 * `AvatarMark` has in the tables, arriving one component up.
 *
 * The radius is a PERCENTAGE, which is the whole reason it is worth naming: the
 * same class is right at every size this is rendered at, unlike the fixed
 * `min()` radius `components/admin/glyphs.tsx` uses for its 24px table avatars,
 * which would read as a barely-rounded square at 112px.
 */
export const PLANT_MARK = "size-28 overflow-hidden rounded-[28%]";

/**
 * What goes inside the mark: the logo, or the plant's initials.
 *
 * The fallback is not a flourish, and it is not optional on the public page.
 * A left-aligned logo can be absent and the title simply moves up; a CENTRED
 * stack with a missing first element collapses into something that reads as
 * broken rather than as logo-less. It is the same fallback the garden table, the
 * palette and the admin hero draw, so a plant with no mark looks the same in all
 * four places.
 *
 * Decorative in both zones — the name is the very next element — so the caller
 * owns the `aria-hidden` or the `aria-label`, depending on whether its mark is a
 * fact or a button.
 */
export function PlantMarkContent({ logoUrl, name }: { logoUrl?: string; name: string }) {
  return logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cloudinaryThumb(logoUrl, { width: 224, height: 224 })}
      alt=""
      decoding="async"
      className="size-full object-cover"
    />
  ) : (
    <span className="flex size-full items-center justify-center bg-muted font-heading text-3xl tracking-tight text-muted-foreground">
      {initialsOf(name)}
    </span>
  );
}

/**
 * The title's face, and the one token this slice exists to settle.
 *
 * `font-normal` is mandatory rather than stylistic: Profane ships ONE weight,
 * and `app/globals.css` records that every user pairs it with `font-normal` so
 * nothing asks the family for a bold it does not have. The admin's old
 * `font-medium` was asking for exactly that, and getting a synthesised weight.
 */
const TITLE = "font-display text-4xl font-normal tracking-tight sm:text-5xl";

export function PlantHeader({
  mark,
  title,
  description,
  facts,
  children,
}: {
  /**
   * The squircle — a plain `<div>` on the public page, a popover trigger in the
   * admin, and ABSENT for an entity that has no mark.
   *
   * Optional since the sprout's edition slice. The docblock above argues the
   * mark's FALLBACK is not optional, and that still holds: a centred stack whose
   * first element renders empty reads as broken, which is why
   * `PlantMarkContent` draws initials rather than nothing. But a sprout has no
   * logo and no monogram — a two-letter mark for a piece of writing is a
   * decoration standing where a fact belongs — so it has no first element to
   * miss, and the stack simply starts at the title.
   *
   * The distinction to keep: a caller that HAS a mark must always render one.
   * Passing `undefined` is a statement about the entity, never a shortcut for a
   * mark that failed to load.
   */
  mark?: ReactNode;
  /** The name, or a control wrapping it. Rendered INSIDE the h1 either way. */
  title: ReactNode;
  /** Already resolved to the reading language, and already trimmed. */
  description?: string;
  /** Role, status and (in the admin) visibility — words on one side, triggers on the other. */
  facts?: ReactNode;
  /** Anything below the facts: the role's detail line, the natures. */
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col items-center gap-5 text-center">
      {mark}

      {/* The h1 is rendered HERE, in both zones, and the admin's sheet trigger
          goes inside it rather than instead of it — so the admin page still has
          exactly one document title, which is the property plant-hero.tsx was
          already protecting when it owned this markup. */}
      <div className="flex flex-col items-center gap-1.5">
        <h1 className={TITLE}>{title}</h1>
        {description ? (
          <p className="max-w-prose text-base text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {facts}
      {children}
    </header>
  );
}
