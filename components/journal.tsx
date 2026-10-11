import { resolveText } from "@/lib/data";
import type { Lang } from "@/lib/locale";
import { sproutKindLabel } from "@/lib/glyphs";
import { publicSproutHref, type BeanstalkEntry } from "@/lib/beanstalk";
import { PUBLIC_HREFS } from "@/lib/lineage";
import { Badge } from "@/components/ui/badge";

/**
 * The journal line — one sprout or one exhibited pollen event — drawn ONCE for
 * every surface that lists growth over time: `/beanstalk` (every plant, with
 * its `?plant=` filter), a plant page (its own entries and its own pollen), a
 * pod page and a bean page (their own entries, no pollen). The pages differ in
 * WHICH entries they hand over; this file does not know which page it is on.
 * That is the shared-surfaces rule from CLAUDE.md doing its work, and why this
 * file is in `lib/server-safe-source.test.ts`: it renders under every public
 * page, so it carries no `"use client"`, no lucide, no `next/link`.
 *
 * A sprout line links to `/sprout/[slug]` — the entry's own page — never to its
 * bean: a published entry about a private bean has a page a visitor may read,
 * while its bean does not, and `filterPublic` has already scrubbed the ref.
 * A pollen line links to the source and, when the anchored bean survived the
 * projection, names it as a second, smaller door.
 *
 * Zero entries is NO journal — no heading, no border, no empty list — exactly
 * as the bean page's rail: an absent section is a statement about the garden,
 * an empty one is a component that failed.
 */
export function Journal({
  entries,
  lang,
  heading,
}: {
  entries: BeanstalkEntry[];
  lang: Lang;
  /**
   * Set on an entity page ("Journal"); absent on `/beanstalk`, which owns its
   * h1. Convention: pass an English word — UI chrome in this zone is never
   * localised.
   */
  heading?: string;
}) {
  if (entries.length === 0) return null;

  const list = (
    <ul className="reveal-each flex flex-col gap-4" {...(heading ? { "aria-label": heading } : {})}>
      {entries.map((e) =>
        e.type === "sprout" ? (
          <li key={`sprout:${e.entry.sprout.slug}`} className="flex flex-col gap-1">
            <span className="text-base">
              <a
                href={publicSproutHref(e.entry.sprout.slug)}
                className="underline-offset-4 transition-colors hover:underline"
              >
                {resolveText(e.entry.sprout.name, lang)}
              </a>
            </span>
            <span className="flex flex-wrap items-center gap-2 font-heading text-xs text-muted-foreground">
              <time dateTime={e.entry.sprout.date}>{e.date}</time>
              <Badge variant="secondary">{sproutKindLabel(e.entry.sprout.kind)}</Badge>
            </span>
          </li>
        ) : (
          <li key={`pollen:${e.pollen.id}`} className="flex flex-col gap-1">
            <span className="text-base">
              {e.url ? (
                <a href={e.url} className="underline-offset-4 transition-colors hover:underline">
                  {resolveText(e.pollen.title, lang)}
                </a>
              ) : (
                resolveText(e.pollen.title, lang)
              )}
            </span>
            <span className="flex flex-wrap items-center gap-2 font-heading text-xs text-muted-foreground">
              <time dateTime={e.pollen.at}>{e.date}</time>
              <Badge variant="secondary">{e.pollen.kind}</Badge>
              <span>{e.pollen.source}</span>
              {e.beanSlug ? (
                <a
                  href={PUBLIC_HREFS.bean(e.beanSlug)}
                  className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {e.beanSlug}
                </a>
              ) : null}
            </span>
          </li>
        ),
      )}
    </ul>
  );

  if (!heading) return list;

  // The entity pages' section shape — the pod page's "Inside" heading,
  // verbatim, so the journal reads as the second index on the page rather than
  // a new kind of thing.
  return (
    <section className="reveal flex flex-col gap-4 border-t pt-6">
      <h2 className="font-heading text-xs uppercase tracking-widest text-muted-foreground">{heading}</h2>
      {list}
    </section>
  );
}
