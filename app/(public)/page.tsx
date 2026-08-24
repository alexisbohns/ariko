import { resolveText } from "@/lib/data";
import type { Bean, Pod } from "@/lib/data";
import { getPublicDataset } from "@/lib/store";
import { coverFor } from "@/lib/cover";
import { roleLine } from "@/lib/plant-role";
import { cloudinaryThumb } from "@/lib/image-url";
import { ArikoLogo } from "@/components/brand/ariko-logo";
import { PROFANE_WOFF2_URL } from "@/app/fonts";

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
  coverUrl: string | null;
};

export default async function DirectoryPage() {
  const data = await getPublicDataset();
  const plants = data.getPlants();
  const unrooted = data.unrootedPods();
  const standalone = data.standaloneBeans();

  // sproutsForBean is newest-first (buildDataset), which is the ordering
  // coverFor expects.
  const beanCover = (bean: Bean) => coverFor(data.sproutsForBean(bean.slug))?.url ?? null;

  const beanEntry = (bean: Bean): Entry => ({
    key: `bean:${bean.slug}`,
    href: `/bean/${bean.slug}`,
    title: resolveText(bean.name),
    // One muted line, never markdown: descriptions are one-liners, content is not (spec §5).
    description: resolveText(bean.description ?? ""),
    coverUrl: beanCover(bean),
  });

  // A pod has no cover of its own — it borrows the first one its beans can
  // offer, the same derivation coverFor makes one level down. A pod whose beans
  // are all coverless simply shows the empty frame, like any other entry.
  const podEntry = (pod: Pod): Entry => {
    const beans = data.beansForPod(pod.slug);
    return {
      key: `pod:${pod.slug}`,
      href: `/pod/${pod.slug}`,
      title: resolveText(pod.name),
      description: resolveText(pod.description ?? ""),
      coverUrl: beans.map(beanCover).find(Boolean) ?? null,
    };
  };

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
          <li key={entry.key} className="w-56 shrink-0">
            <a href={entry.href} className="group flex flex-col gap-3">
              <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
                {entry.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    // Cloudinary shrinks it for us — 2x the 224px box, so the
                    // cover stays sharp on a retina display without shipping
                    // the multi-megabyte original.
                    src={cloudinaryThumb(entry.coverUrl, { width: 448, height: 336 })}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-heading text-sm tracking-tight underline-offset-4 group-hover:underline">
                  {entry.title}
                </span>
                {entry.description.trim() ? (
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {entry.description}
                  </span>
                ) : null}
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <main className="pb-20">
      {/* The display face is not bundled (it is served from Cloudinary — see
          app/fonts.ts), so nothing preloads it for us. React hoists this into
          <head>; `crossOrigin` is required because a font fetch is always an
          anonymous CORS request, and without it the browser downloads the file
          twice. Only this page wears the face, so only this page asks for it. */}
      <link
        rel="preload"
        href={PROFANE_WOFF2_URL}
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      {/* No nav bar here: the landing wears the mark, centred, with room to breathe. */}
      <header className={`${GUTTER} flex justify-center py-20`}>
        <ArikoLogo title="Ariko" className="h-20 w-auto text-foreground sm:h-24" />
      </header>

      <div className="flex flex-col gap-14">
        {plants.map((plant) => {
          // A bean parented to BOTH the plant and one of its pods appears in each
          // place — multi-parent membership is by design.
          const entries = [
            ...data.podsForPlant(plant.slug).map(podEntry),
            ...data.beansForPlant(plant.slug).map(beanEntry),
          ];
          return (
            <section key={plant.slug} className="flex flex-col gap-5">
              <div className={`${GUTTER} flex flex-col gap-2`}>
                <h2 className="font-display text-3xl font-normal tracking-tight sm:text-4xl">
                  <a href={`/plant/${plant.slug}`} className="underline-offset-4 hover:underline">
                    {resolveText(plant.name)}
                  </a>
                </h2>
                {/* A subtitle, not a badge: a pill beside a text-4xl display
                    title reads as UI chrome interrupting the typography, where
                    a small line reads as part of the heading. `detail` stays
                    off this surface — too long for a section header. */}
                <p className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
                  {roleLine(plant.role)}
                </p>
                {resolveText(plant.description ?? "").trim() ? (
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    {resolveText(plant.description)}
                  </p>
                ) : null}
              </div>
              {entries.length > 0 ? cardRow(entries) : null}
            </section>
          );
        })}

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
