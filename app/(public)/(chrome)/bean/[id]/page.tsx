import { notFound } from "next/navigation";
import { resolveText } from "@/lib/data";
import { currentLang } from "@/lib/locale-server";
import { getPublicDataset } from "@/lib/garden-cache";
import { articleFor } from "@/lib/article";
import { Prose } from "@/components/markdown";
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
        <h1 className="font-heading text-2xl font-medium tracking-tight">{resolveText(bean.name, lang)}</h1>

        {resolveText(bean.description ?? "", lang).trim() ? (
          <p className="text-base text-muted-foreground">{resolveText(bean.description, lang)}</p>
        ) : null}

        {article ? (
          <Prose
            lang={lang}
            content={article.content}
            resolve={(ref) => resolveEntity(data, ref, lang)} />
        ) : null}
      </article>

      {/* Zero is NO rail — no heading, no border, no empty box under the word
          "Keep reading". A standalone bean reaches this, and so does the first
          bean written under a new plant. An absent rail is a statement about
          the garden; an empty one is a component that failed. */}
      {related.length > 0 ? (
        <nav aria-label="Keep reading" className="mt-16 flex flex-col gap-6 border-t pt-8">
          {/* The pod page's "Inside" treatment, verbatim — the footer matches
              the only other index in the zone rather than inventing a second.
              English regardless of the language switch, as every other piece of
              UI chrome in this zone is (the lineage chrome's Plants/Pods/Beans,
              the pod page's Inside). */}
          <h2 className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
            Keep reading
          </h2>
          {/* A WRAPPING ROW, not a grid with a track width: the card carries
              its own 224px (`w-56` on its anchor in components/bean-card.tsx,
              where the phone cover's pixel geometry requires it), so a
              `grid-cols-[repeat(auto-fill,14rem)]` here would state the same
              number a second time and let the two drift. Three fit the 720px
              reading column, one fits a phone, and neither is written down.

              NO `group` on this element or any wrapper: Tailwind's
              `group-hover:` matches ANY ancestor carrying it, and every cover's
              choreography is group-hover on its own card's anchor — so a
              `group` here would animate all six covers whenever the pointer
              entered the rail. */}
          <ul className="flex flex-wrap gap-4">
            {related.map((sibling) => (
              <li key={sibling.slug}>
                <BeanCard
                  href={`/bean/${sibling.slug}`}
                  title={resolveText(sibling.name, lang)}
                  description={resolveText(sibling.description ?? "", lang)}
                  coverArt={
                    <BeanCover
                      cover={beanCoverFor(sibling, data.sproutsForBean(sibling.slug))}
                      lang={lang}
                    />
                  }
                />
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </>
  );
}
