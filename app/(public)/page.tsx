import { resolveText } from "@/lib/data";
import type { Bean, Plant, Pod } from "@/lib/data";
import { currentLang } from "@/lib/locale-server";
import { getPublicDataset } from "@/lib/garden-cache";
import { beanCoverFor, podCoverFrom, type BeanCover } from "@/lib/bean-cover";
import { roleLine } from "@/lib/plant-role";
import { splitPlantsByStatus } from "@/lib/plant-status";
import { cloudinaryThumb } from "@/lib/image-url";
import { ArikoLogo } from "@/components/brand/ariko-logo";
import { ProfanePreload } from "@/components/brand/profane-preload";
import { BeanCover as BeanCoverArt } from "@/components/bean-cover";
import { BeanCard } from "@/components/bean-card";

export const dynamic = "force-dynamic";

/**
 * The one gutter, worn by the headings and by the card tracks alike — which is
 * what guarantees a plant's title and its first card share a left edge.
 *
 * It centres a 61rem content band and never lets the gutter fall below 1.5rem,
 * so below ~64rem of viewport it IS `px-6`, and above it the padding grows with
 * the margin instead of jumping. Both users of it are full-width blocks: a
 * `max-w-*` on either one would reintroduce the offset this replaces.
 */
const GUTTER = "px-[max(1.5rem,calc((100%-61rem)/2))]";

/** The card face: cover, title, one muted line. */
type Entry = {
  key: string;
  href: string;
  title: string;
  description: string;
  // Not a URL: what to DRAW there. The rule lives in one place, lib/bean-cover.ts.
  // A pod's is its first bean's, minus the word (podCoverFrom).
  cover: BeanCover | null;
};

export default async function DirectoryPage() {
  const lang = await currentLang();
  const data = await getPublicDataset();
  const { active, inactive } = splitPlantsByStatus(data.getPlants());
  const unrooted = data.unrootedPods();
  const standalone = data.standaloneBeans();

  // sproutsForBean is newest-first (buildDataset), which is the ordering
  // coverFor documents that it expects, and which beanCoverFor passes
  // straight through.
  const coverOf = (bean: Bean) => beanCoverFor(bean, data.sproutsForBean(bean.slug));

  const beanEntry = (bean: Bean): Entry => ({
    key: `bean:${bean.slug}`,
    href: `/bean/${bean.slug}`,
    title: resolveText(bean.name, lang),
    // One muted line, never markdown: descriptions are one-liners, content is not (spec §5).
    description: resolveText(bean.description ?? "", lang),
    cover: coverOf(bean),
  });

  // A pod has no cover of its own — it borrows the first one its beans can
  // offer. It borrows the ARTWORK and not the word: the keyword names the bean,
  // so on a pod card it would name the wrong thing (podCoverFrom).
  const podEntry = (pod: Pod): Entry => ({
    key: `pod:${pod.slug}`,
    href: `/pod/${pod.slug}`,
    title: resolveText(pod.name, lang),
    description: resolveText(pod.description ?? "", lang),
    cover: podCoverFrom(data.beansForPod(pod.slug).map(coverOf)),
  });

  /* Full-bleed scroller. The row must NOT live inside the padded column: a
     clipped `overflow-x-auto` cuts the cards off at the text margin, which
     reads as a broken layout rather than as a gallery. So the track spans the
     viewport and the GUTTER — the very one the headings wear — is padding on the
     track's own content, keeping the first card flush with the headings above
     it while the rest of the row runs to the edge and past it.

     `overscroll-x-none` stops a horizontal scroll that reaches the end of the
     row from escaping the track at all — no chaining to the page, no browser
     back/forward from a trackpad flick (the document-level half of that rule
     lives in `app/globals.css`). `no-scrollbar` hides the bar itself: the cards
     running off the edge are the affordance. */
  const cardRow = (entries: Entry[]) => (
    <div className="no-scrollbar overflow-x-auto overscroll-x-none pb-2">
      <ul className={`flex w-max gap-4 ${GUTTER}`}>
        {entries.map((entry) => (
          // w-56 is 224px, and components/bean-cover.tsx derives its phone
          // geometry from that number — widen the card and the numbers in
          // that file need revisiting.
          <li key={entry.key} className="w-56 shrink-0">
            <BeanCard
              href={entry.href}
              title={entry.title}
              description={entry.description}
              coverArt={<BeanCoverArt cover={entry.cover} lang={lang} />}
            />
          </li>
        ))}
      </ul>
    </div>
  );

  const plantSection = (plant: Plant) => {
    // A bean parented to BOTH the plant and one of its pods appears in each
    // place — multi-parent membership is by design.
    const entries = [
      ...data.podsForPlant(plant.slug).map(podEntry),
      ...data.beansForPlant(plant.slug).map(beanEntry),
    ];
    return (
      <section key={plant.slug} className="flex flex-col gap-5">
        <div className={`${GUTTER} flex flex-col gap-3`}>
          {/* The plant's mark, above its name and left-aligned to the same
              gutter, so the logo, the title and the first card of the row all
              share one left edge.

              Absent ⇒ nothing drawn, and the title simply sits where it did
              before. No placeholder square: a mixed gallery is briefly ragged
              while logos are still being uploaded, where an empty frame would
              be permanently wrong.

              alt="" because it is decorative — the plant's name is the very
              next element, and a screen reader announcing both would say it
              twice. */}
          {plant.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cloudinaryThumb(plant.logo.url, { width: 96, height: 96 })}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-12 w-12 rounded-xl object-cover"
            />
          ) : null}
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-3xl font-normal tracking-tight sm:text-4xl">
              <a href={`/plant/${plant.slug}`} className="underline-offset-4 hover:underline">
                {resolveText(plant.name, lang)}
              </a>
            </h2>
            {/* A subtitle, not a badge: a pill beside a text-4xl display
                title reads as UI chrome interrupting the typography, where
                a small line reads as part of the heading. `detail` stays
                off this surface — too long for a section header. */}
            <p className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
              {roleLine(plant.role)}
            </p>
            {resolveText(plant.description ?? "", lang).trim() ? (
              <p className="max-w-2xl text-sm text-muted-foreground">
                {resolveText(plant.description, lang)}
              </p>
            ) : null}
          </div>
        </div>
        {entries.length > 0 ? cardRow(entries) : null}
      </section>
    );
  };

  return (
    <main className="pb-20">
      <ProfanePreload />
      {/* No nav bar here: the landing wears the mark, centred, with room to breathe. */}
      <header className={`${GUTTER} flex justify-center py-20`}>
        <ArikoLogo title="Ariko" className="h-20 w-auto text-foreground sm:h-24" />
      </header>

      <div className="flex flex-col gap-14">
        {active.map(plantSection)}

        {/* Rendered only when there is something under it — an all-active
            garden shows no divider at all.

            Separation carries the whole meaning here: the inactive plants below
            are NOT dimmed, tagged or shrunk. Opacity would say "deprecated"
            where the page means "finished", and finished work is still work
            worth looking at. */}
        {inactive.length > 0 ? (
          <div className="flex flex-col gap-14">
            {/* A divider, not a peer. A plant's name is the h2 rank on this
                page, so rendering "Inactive" at font-display text-4xl would
                make it read as loud as "Femfolk" — inverting the hierarchy the
                split exists to create. It wears the role line's register
                instead. */}
            <h2
              className={`${GUTTER} border-t pt-6 font-heading text-xs uppercase tracking-widest text-muted-foreground`}
            >
              Inactive
            </h2>
            {inactive.map(plantSection)}
          </div>
        ) : null}

        {unrooted.length > 0 || standalone.length > 0 ? (
          <section className="flex flex-col gap-5">
            <h2 className={`${GUTTER} font-display text-3xl font-normal tracking-tight sm:text-4xl`}>
              Unrooted
            </h2>
            {cardRow([...unrooted.map(podEntry), ...standalone.map(beanEntry)])}
          </section>
        ) : null}
      </div>
    </main>
  );
}
