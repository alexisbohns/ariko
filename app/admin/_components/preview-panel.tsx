import type { ReactNode } from "react";

/**
 * The plant hub's section shell — the only place a hub section's SHAPE is
 * decided: a heading row (a title, an optional muted suffix, an optional
 * trailing link) and then either the section's contents or one muted line
 * saying there are none.
 *
 * It exists because the hub draws five sections that must look like one thing
 * while meaning two: four of them are a SET (a count, and the way out to the
 * section that owns it) and one is the plant's own NARRATIVE (no count, and a
 * way in to the editor). Both wrappers below compose this, and each decides
 * only its own words — which is why neither can invent a second shape, and why
 * a change to the shape happens once.
 *
 * It composes no href and no query, and reads no field: everything it draws
 * arrives as a prop from the page.
 */
export function PreviewSection({
  title,
  suffix,
  link,
  empty,
  children,
}: {
  title: string;
  /** The muted half of the heading — a count, usually. */
  suffix?: ReactNode;
  /** The way out of this section, or none. */
  link?: { href: string; label: string };
  /** Drawn INSTEAD of the children when present — the caller decides which. */
  empty?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-base tracking-tight">
          {title}
          {suffix ? <span className="text-muted-foreground"> {suffix}</span> : null}
        </h2>
        {link ? (
          <a
            href={link.href}
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {link.label}
          </a>
        ) : null}
      </div>
      {empty ? <p className="text-sm text-muted-foreground">{empty}</p> : children}
    </section>
  );
}

/**
 * A hub preview: a heading, the count, the rows, and the way out to the
 * section that owns them.
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
    <PreviewSection
      title={title}
      suffix={`(${count})`}
      link={count > 0 ? { href: allHref, label: `all ${count} →` } : undefined}
      empty={count === 0 ? "nothing yet" : undefined}
    >
      {children}
    </PreviewSection>
  );
}
