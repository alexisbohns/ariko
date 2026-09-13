import { notFound } from "next/navigation";
import { resolveText, textPart } from "@/lib/data";
import { getFullDataset, loadRawGarden } from "@/lib/store";
import { beanDetail, type BeanDetailView } from "@/lib/bean-detail";
import { beanCoverFor } from "@/lib/bean-cover";
import { visibilityOf } from "@/lib/plant-visibility";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BeanCoverForm } from "@/app/admin/_components/bean-cover-form";
import { BeanHero, type Surface } from "@/app/admin/_components/bean-hero";
import { BeanMetaForm } from "@/app/admin/_components/bean-meta-form";
import { SproutTable } from "@/app/admin/_components/sprout-table";
import { EntityRail, type RailItem } from "@/app/admin/_components/entity-rail";
// Not from lucide-react. `RailItem.icon` crosses into a client component and this
// file is a server one, so the icons have to arrive as client references — see
// _components/rail-icons.ts, which is the whole of that boundary.
import { Image } from "@/app/admin/_components/rail-icons";
import Link from "next/link";
import { resolveLineage, ADMIN_HREFS } from "@/lib/lineage";
import { LineageChrome } from "@/components/lineage-chrome";

export const dynamic = "force-dynamic";

/**
 * One bean, as a place you come to in order to EDIT it.
 *
 * The sibling of `sprout/[slug]/page.tsx`, and the last entity page to stop being
 * a property dump. What left, and why:
 *
 *  - The **five-row dump** (`bean`, `visibility`, `plant`, `pod`, `tags`). Two of
 *    its rows are now facts you can edit from the head; the other two are the
 *    lineage chrome above, which has said them since the parenting slice.
 *  - The **two cover cards**. The cover is on the rail, where its real aspect
 *    survives; the keyword is a fact in the head, beside the other two.
 *  - The **Versions cards**. "Version" is a word the garden's vocabulary does not
 *    have — they are sprouts, and they are drawn by the same `SproutTable` every
 *    other sprout listing in the admin uses. The per-sprout scalar dump went with
 *    them: it was a debugging surface, and the sprout's own page is one click away
 *    in the first column.
 *
 * The head and the meta form read the STORED bean, not `beanDetail`'s view model:
 * that one resolves `name` to a display string (B1), which is right for the error
 * card above and wrong for a form — an fr name would prefill the en box and save
 * back as en, which is the trap every meta form in this repo documents.
 */
export default async function AdminBeanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; form?: string }>;
}) {
  const { id } = await params;
  const { error, form } = await searchParams;

  let view: BeanDetailView | null = null;
  let failed = false;
  try {
    view = beanDetail(await getFullDataset(), id);
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <article>
        <h1 className="mb-4 font-heading text-2xl font-medium tracking-tight">Bean</h1>
        <Alert variant="destructive" role="alert">
          <AlertDescription>Couldn&apos;t load the bean.</AlertDescription>
        </Alert>
      </article>
    );
  }

  if (!view) notFound();

  const { plant: plantSlug, sprouts } = view;

  // The LIVE garden, per CLAUDE.md's garden rule: the admin reads live, and the
  // chrome is the surface most likely to be looked at right after a rename. "en"
  // rather than a negotiated language — the admin zone is authored in one.
  const raw = await loadRawGarden();

  // The stored bean, unresolved. See the docblock: every write surface reads this
  // one, and only the error card above reads the view model.
  const bean = raw.beans?.find((b) => b.slug === id);
  if (!bean) notFound();

  const lineage = resolveLineage(bean.parents, raw, { lang: "en", hrefs: ADMIN_HREFS });

  // `beanDetail` gives Sprout[]; SproutTable takes TimelineEntry[], because an
  // entry already carries the sprout with its bean and its plant resolved and a
  // row type here would be that entry re-typed. Both parents are already in hand,
  // so the entries are composed rather than re-queried.
  const plant = plantSlug ? (raw.plants?.find((p) => p.slug === plantSlug) ?? null) : null;
  const entries = sprouts.map((sprout) => ({ sprout, bean, plant }));

  /* The keyword is drawn ONLY on the phone treatment, and only an explicit
     PORTRAIT cover reaches it. A landscape screenshot with a keyword typed under
     it is a silent no-op, so the keyword popover says so rather than letting the
     author guess.

     Asked of beanCoverFor rather than re-derived here — portrait-ness is
     lib/bean-cover.ts's rule and stays there, and the island receives only the
     RESULT. The empty sprouts array is safe because an explicit cover
     short-circuits the derivation, and the Boolean(bean.cover) guard is what
     makes that true. */
  const keywordDrawn = Boolean(bean.cover) && beanCoverFor(bean, [])?.kind === "phone";

  // Which surface a rejected save came from — narrowed here rather than trusted.
  // Both halves require the ERROR as well as the name: `?form=` alone is a bare
  // URL anyone can type or a stale link someone kept, and honouring it would open
  // a surface with nothing to explain why. An unknown `?form=` claims no surface,
  // and its message falls through to the page-level banner below.
  const heroForm: Surface | undefined =
    error && (form === "meta" || form === "visibility") ? form : undefined;

  /* A projected bean is source-owned: lib/data.ts's own declaration of the field
     says "read-only in the admin, source-owned, rebuildable", and
     lib/pollen-store.ts's deleteFeedData deletes the whole document on a full
     rebuild — an authored cover, keyword or tag list with it. The head states its
     facts as words instead of triggers, and the rail loses its one panel. Each of
     the four actions re-checks this server-side, because a rendered gate is not a
     guarantee. */
  const readOnly = Boolean(bean.projected);

  const railItems: RailItem[] = readOnly
    ? []
    : [
        {
          id: "cover",
          label: "Cover",
          heading: "Cover",
          icon: Image,
          panel: <BeanCoverForm bean={bean} />,
        },
      ];

  return (
    <>
      <LineageChrome lineage={lineage} as={Link} />
      {/* EntityRail wraps the WHOLE body: the panel is fixed and the page moves
          out from under it, so what moves has to be everything. The parenting
          chrome above floats, so it sits outside. */}
      <EntityRail label="Bean panels" items={railItems}>
        <article className="flex flex-col gap-8">
          <BeanHero
            slug={bean.slug}
            /* Resolved HERE: bean-hero.tsx is a client island and a value import
               from @/lib/data would fail the build (node:fs). */
            name={resolveText(bean.name)}
            description={resolveText(bean.description ?? "").trim()}
            visibility={visibilityOf(bean)}
            /* STRICT textPart on both halves — resolveText's fallback would copy
               the fr keyword into the en box and save it back as en. */
            keywordEn={textPart(bean.keyword, "en")}
            keywordFr={textPart(bean.keyword, "fr")}
            tags={bean.tags ?? []}
            keywordDrawn={keywordDrawn}
            readOnly={readOnly}
            {...(heroForm ? { error, errorForm: heroForm } : {})}
            metaForm={<BeanMetaForm bean={bean} />}
            /* Everything the head can write, as stored. STRICT textPart on both
               halves of each pair, so an fr-only edit still moves the fingerprint
               — resolveText would fall back and hide it. */
            saved={JSON.stringify([
              textPart(bean.name, "en"),
              textPart(bean.name, "fr"),
              textPart(bean.description, "en"),
              textPart(bean.description, "fr"),
              visibilityOf(bean),
              textPart(bean.keyword, "en"),
              textPart(bean.keyword, "fr"),
              (bean.tags ?? []).join(" "),
            ])}
          />

          {bean.projected ? (
            <Alert role="note">
              <AlertDescription>
                Projected from {bean.projected.source} (feed {bean.projected.feedId}) — read-only,
                rebuilt from the feed.
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Only an error no surface will show: the head reopens onto a rejected
              meta or visibility save and renders the message inside, so repeating
              it here would say it twice. */}
          {error && !heroForm ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <section className="flex flex-col gap-4">
            <h2 className="font-heading text-lg tracking-tight">
              Sprouts <span className="text-muted-foreground">({sprouts.length})</span>
            </h2>
            {sprouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sprouts yet.</p>
            ) : (
              /* Neither column says anything here: the plant is in the lineage
                 chrome above and the bean is the page. */
              <SproutTable entries={entries} showPlant={false} showBean={false} />
            )}
          </section>
        </article>
      </EntityRail>
    </>
  );
}
