import { notFound } from "next/navigation";
import { resolveText } from "@/lib/data";
import { currentLang } from "@/lib/locale-server";
import { getPublicDataset } from "@/lib/garden-cache";
import { articleFor } from "@/lib/article";
import { Prose } from "@/components/markdown";
import { seq } from "@/components/reveal";
import { resolveEntity } from "@/lib/entity-resolve";
import { resolveLineage, PUBLIC_HREFS } from "@/lib/lineage";
import { LineageChrome } from "@/components/lineage-chrome";
import { relatedBeans } from "@/lib/related-beans";
import { beanCoverFor } from "@/lib/bean-cover";
import { BeanCard } from "@/components/bean-card";
import { BeanCover } from "@/components/bean-cover";

export const dynamic = "force-dynamic";

/**
 * One bean, as a visitor reads it: its name, its description, and its article.
 *
 * The per-sprout cards are GONE — the last property dump in the repo, retired
 * here the way the admin's was in the bean-edition slice. It had been marked for
 * D1 since the content-render slice, and what finally made the case is that its
 * bulk was a duplicate: `Sprout.content` is a plain string on most sprouts, so
 * `isScalar` admitted it and the dump reprinted, in mono, the exact markdown the
 * `Prose` above had just rendered.
 *
 * It took the sprout's `links[]` and `media[]` with it, deliberately and with
 * the cost understood: this page was the ONLY public route to either, so the
 * players, the images and the "Listen on …" destinations leave the public site
 * entirely rather than moving somewhere else.
 *
 * Both renderers are KEPT rather than deleted, and they are kept on different
 * grounds. `components/link-row.tsx` still draws a PLANT's links on
 * `plant/[slug]`, so it is simply still in use. `components/media.tsx` is not:
 * its only importer outside `components/media.test.tsx` was the line below this
 * one. It stays because what it holds is not layout — it is the provider
 * reasoning (`embedSrc`, the three measured frame boxes, the trust ladder that
 * turns an underivable embed into a link out rather than a frame) and the
 * public zone's no-lucide rule written down where it bites. Deleting it would
 * throw that away to save a file nothing renders; it is still pinned by
 * `lib/server-safe-source.test.ts`, so it cannot rot into a client component
 * while it waits. Putting a sprout's assets back on a page is then a rendering
 * decision, not a rebuild.
 *
 * `sproutsForBean` therefore survives for exactly one reader: `articleFor`,
 * which picks the newest published sprout carrying content (spec §4).
 *
 * The rail beneath it is `lib/related-beans.ts` — pod siblings first, topped up
 * from the plant, and never a bean with nothing written under it. It draws
 * `components/bean-card.tsx`, the landing page's own card, so a visitor who
 * reaches a bean from the landing page meets the same object twice.
 */
export default async function BeanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = await currentLang();
  const data = await getPublicDataset();
  const bean = data.getBean(id);
  if (!bean) notFound();

  const article = articleFor(data.sproutsForBean(bean.slug));

  // From the FILTERED dataset, so a private pod or plant is simply absent from
  // the trail — resolveLineage drops a ref it cannot resolve, which is the
  // privacy projection doing the work rather than a second check here.
  const lineage = resolveLineage(
    bean.parents,
    { plants: data.getPlants(), pods: data.getPods() },
    { lang, hrefs: PUBLIC_HREFS },
  );

  // From the same FILTERED dataset the rest of the page reads, so a private
  // sibling is simply absent — `relatedBeans` runs no privacy check of its own
  // and must not grow one (lib/related-beans.ts says why).
  const related = relatedBeans(data, bean);

  return (
    <>
      <LineageChrome lineage={lineage} />
      <article className="flex flex-col gap-8">
        <h1 {...seq(0, "font-heading text-2xl font-medium tracking-tight")}>
          {resolveText(bean.name, lang)}
        </h1>

        {resolveText(bean.description ?? "", lang).trim() ? (
          <p {...seq(1, "text-base text-muted-foreground")}>
            {resolveText(bean.description, lang)}
          </p>
        ) : null}

        {article ? (
          <Prose
            reveal
            lang={lang}
            content={article.content}
            resolve={(ref) => resolveEntity(data, ref, lang)}
          />
        ) : null}
      </article>

      {/* Zero is NO rail — no heading, no border, no empty box under the word
          "Keep reading". A standalone bean reaches this, and so does the first
          bean written under a new plant. An absent rail is a statement about
          the garden; an empty one is a component that failed. */}
      {related.length > 0 ? (
        <nav aria-label="Keep reading" className="reveal mt-16 flex flex-col gap-4 border-t pt-6">
          {/* The pod page's "Inside" HEADING, verbatim — the footer matches
              the only other index in the zone rather than inventing a second.
              English regardless of the language switch, as every other piece of
              UI chrome in this zone is (the lineage chrome's Plants/Pods/Beans,
              the pod page's Inside).

              Named rather than bare — the pod page's "Inside" is the outlier,
              and this page already carries two other navs (the chrome's and
              the lineage's), so a third unnamed "navigation" in the landmark
              list is the outcome to avoid. The name is an `aria-label` rather
              than `aria-labelledby` on the heading because that needs an `id`,
              and `components/toc-rail.tsx` indexes `main h2[id]` — an id here
              would file "Keep reading" in the article's own contents. */}
          <h2 className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
            Keep reading
          </h2>
          {/* A FLUID GRID, not a wrapping row with a fixed cell: the card no
              longer dictates a width — `components/bean-cover.tsx` expresses
              its phone composition in container-query units against the
              frame's own size, so the card scales cleanly at any width the
              grid hands it, and the track can simply say how many columns.

              `READING_COLUMN` is `max-w-3xl px-6`, i.e. `min(viewport, 768) -
              48` of content: a 375px phone → 327px → one full-width card; at
              `sm` (640px) → 592px → two cards of ~288px; at `md` (768px) and
              up → 720px → three cards of ~229px. Each breakpoint fills the
              column exactly, with no leftover slack. One full-width card on a
              phone is the point of switching to a grid at all — the old fixed
              224px card sat in a 327px column and left a bare strip of dead
              space beside it, which read as a mistake rather than a layout.

              `gap-x-4 gap-y-8`: the ROW gap is larger than the column gap on
              purpose — a wrapped rail stacks a description directly above the
              next row's cover, and tiles want more vertical air between them
              than horizontal.

              NO `group` on this element or any wrapper: Tailwind's
              `group-hover:` matches ANY ancestor carrying it, and every cover's
              choreography is group-hover on its own card's anchor — so a
              `group` here would animate all six covers whenever the pointer
              entered the rail. */}
          <ul className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 md:grid-cols-3">
            {related.map((sibling) => (
              <li key={sibling.slug}>
                <BeanCard
                  href={PUBLIC_HREFS.bean(sibling.slug)}
                  title={resolveText(sibling.name, lang)}
                  description={resolveText(sibling.description ?? "", lang)}
                  coverArt={
                    <BeanCover
                      cover={beanCoverFor(sibling, data.sproutsForBean(sibling.slug))}
                      lang={lang}
                    />
                  }
                  // This rail wraps; the landing row scrolls and never does —
                  // clamp is the one prop the two callers differ by.
                  clamp
                />
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </>
  );
}
