import type { Plant } from "@/lib/data";
import { roleLine } from "@/lib/plant-role";
import { statusLabel, statusOf } from "@/lib/plant-status";
import { PlantHeader, PlantMarkContent, PLANT_MARK } from "@/components/plant-header";
import { CrownIcon, ZapIcon, ZapOffIcon } from "@/components/public-icons";
import { Badge } from "@/components/ui/badge";

/**
 * The public plant's head — the admin hero's composition, with every editor
 * removed.
 *
 * A SERVER component. Nothing here opens, nothing here writes, nothing here is
 * a button: the admin's five triggers become five plain facts.
 *
 * The composition itself is no longer this file's. `components/plant-header.tsx`
 * owns the mark, the `<h1>` and the type tokens, and the admin hero fills the
 * same slots with controls — which is what makes the title the author edits the
 * title the visitor reads. Before that file this page and the admin's had
 * separately declared the same squircle and drifted on the typography.
 *
 * What the two also share is the vocabulary: the words come from
 * lib/plant-role.ts and lib/plant-status.ts, and the glyphs are lucide's own
 * path data (components/public-icons.tsx), so the crown here is the crown there.
 *
 * VISIBILITY is not on this page and never will be. A private plant
 * notFound()s, so every plant that renders here is public by construction, and
 * a globe icon would be a fact with no counterexample.
 */

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
    <PlantHeader
      // Decorative: the name is the very next element.
      mark={
        <div aria-hidden="true" className={PLANT_MARK}>
          <PlantMarkContent logoUrl={plant.logo?.url} name={name} />
        </div>
      }
      title={name}
      description={description}
      facts={
        /* Role and status, each an icon and its word.

           BOTH are always present, which overturns this page's old rule — a
           status badge rendered only when inactive, because "active is the
           unmarked default everywhere and a badge saying so on every plant page
           would be noise". That reasoning was right about a BADGE. It is not
           right about an icon+label pair, which is the register this row is in:
           `⚡ Active` beside `♔ Lead` reads as one of two facts stated about the
           plant, where a lone pill in a strip of pills reads as an assertion
           demanding attention. The admin hero states both unconditionally for
           the same reason. The rule is recorded here rather than deleted so it
           does not come back as a bug report. */
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
      }
    >
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
    </PlantHeader>
  );
}
