import type { ReactNode } from "react";

/**
 * A hub preview: a heading, the count, the rows, and the way out to the
 * section that owns them. The wrapper is here so that however many previews a
 * hub ends up carrying, they cannot disagree about what a preview looks like.
 *
 * **`count` is the FULL count, not the number of rows drawn.** The panel
 * decides the heading's number, the `all n →` affordance and the empty state
 * from it, while the rows arrive as children it never inspects — so the two
 * can be made to contradict each other and nothing will complain. A caller
 * that pre-slices and passes `count={rows.length}` renders "Pods (5) · all 5
 * →" over a garden of forty, promising a link that goes nowhere new; and a
 * `count` above zero with empty children renders a headers-only table where
 * "nothing yet" belongs. Pass the length of the unsliced set and give the
 * table its own `limit`.
 *
 * `allHref` is the section pre-filtered by ?plant=, built by the page — this
 * component composes no query and learns no key name.
 */
export function PreviewPanel({
  title,
  count,
  allHref,
  children,
}: {
  title: string;
  count: number;
  allHref: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-base tracking-tight">
          {title} <span className="text-muted-foreground">({count})</span>
        </h2>
        {count > 0 ? (
          <a
            href={allHref}
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            all {count} →
          </a>
        ) : null}
      </div>
      {count === 0 ? <p className="text-sm text-muted-foreground">nothing yet</p> : children}
    </section>
  );
}
