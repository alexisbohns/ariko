import type { Plant } from "@/lib/data";
import { initialsOf } from "@/lib/glyphs";
import { cloudinaryThumb } from "@/lib/image-url";
import { roleLine } from "@/lib/plant-role";
import { statusLabel, statusOf } from "@/lib/plant-status";
import { CrownIcon, ZapIcon, ZapOffIcon } from "@/components/public-icons";
import { Badge } from "@/components/ui/badge";

/**
 * The public plant's head — the admin hero's composition, with every editor
 * removed.
 *
 * A SERVER component. Nothing here opens, nothing here writes, nothing here is
 * a button: the admin's five triggers become five plain facts. That is the
 * whole difference between the two files, and it is why this one is not a
 * shared component with app/admin/_components/plant-hero.tsx — they share a
 * SHAPE, not an implementation, and the admin's is a client island wired to
 * server actions.
 *
 * What they DO share is the vocabulary: the words come from lib/plant-role.ts
 * and lib/plant-status.ts, and the glyphs are lucide's own path data
 * (components/public-icons.tsx), so the crown here is the crown there.
 *
 * VISIBILITY is not on this page and never will be. A private plant
 * notFound()s, so every plant that renders here is public by construction, and
 * a globe icon would be a fact with no counterexample.
 */

/** The mark's shape — the admin hero's radius, as a PERCENTAGE so the same
 *  class is right at every size it is rendered at. */
const SQUIRCLE = "rounded-[28%]";

export function PlantHead({
  plant,
  name,
  description,
  roleDetail,
}: {
  plant: Plant;
  /** Already resolved to the reading language by the page. */
  name: string;
  description: string;
  roleDetail: string;
}) {
  const status = statusOf(plant);
  return (
    <header className="flex flex-col items-center gap-5 text-center">
      {/* The mark, WITH an initials fallback the old left-aligned header did
          not have — and it is forced by the layout, not a flourish. A
          left-aligned logo can be absent and the title simply moves up; a
          CENTRED stack with a missing first element collapses into something
          that reads as broken rather than as logo-less. The fallback is the one
          the garden table, the palette and the admin hero already draw, so a
          plant with no mark looks the same in all four places.

          Decorative either way: the name is the very next element. */}
      <div
        aria-hidden="true"
        className={`size-28 overflow-hidden bg-muted text-muted-foreground ${SQUIRCLE}`}
      >
        {plant.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cloudinaryThumb(plant.logo.url, { width: 224, height: 224 })}
            alt=""
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center font-heading text-3xl tracking-tight">
            {initialsOf(name)}
          </span>
        )}
      </div>

      {/* Profane, and `font-normal` is mandatory rather than a style choice:
          the family ships ONE weight, and app/globals.css records that every
          user pairs it with font-normal so nothing asks it for a bold it does
          not have. */}
      <h1 className="font-display text-4xl font-normal tracking-tight sm:text-5xl">{name}</h1>

      {description ? (
        <p className="max-w-prose text-base text-muted-foreground">{description}</p>
      ) : null}

      {/* Role and status, each an icon and its word.

          BOTH are always present, which overturns this page's old rule — a
          status badge rendered only when inactive, because "active is the
          unmarked default everywhere and a badge saying so on every plant page
          would be noise". That reasoning was right about a BADGE. It is not
          right about an icon+label pair, which is the register this row is now
          in: `⚡ Active` beside `♔ Lead` reads as one of two facts stated about
          the plant, where a lone pill in a strip of pills reads as an assertion
          demanding attention. The admin hero states both unconditionally for
          the same reason. The rule is recorded here rather than deleted so it
          does not come back as a bug report. */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-heading text-xs uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CrownIcon className="size-3.5" />
          {roleLine(plant.role)}
        </span>
        <span
          className={"flex items-center gap-1.5 " + (status === "active" ? "text-primary" : "")}
        >
          {status === "active" ? (
            <ZapIcon className="size-3.5" />
          ) : (
            <ZapOffIcon className="size-3.5" />
          )}
          {statusLabel(status)}
        </span>
      </div>

      {/* The role's one line of context. Never markdown — plants already have
          `content` for prose. */}
      {roleDetail ? <p className="max-w-prose text-sm text-muted-foreground">{roleDetail}</p> : null}

      {plant.natures.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-1.5">
          {plant.natures.map((nature) => (
            <Badge key={nature} variant="secondary">
              {nature}
            </Badge>
          ))}
        </div>
      ) : null}
    </header>
  );
}
