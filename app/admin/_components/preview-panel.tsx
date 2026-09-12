import type { ReactNode } from "react";

/**
 * A hub preview: a heading, the count, the rows, and the way out to the
 * section that owns them. The wrapper is here rather than repeated four times
 * so the four previews cannot disagree about what a preview looks like.
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
