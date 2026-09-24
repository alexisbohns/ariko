import { notFound } from "next/navigation";
import {
  buildDataset,
  hasNarrative,
  resolveText,
  textPart,
  PLANT_PREFIX,
  POD_PREFIX,
  parentsWithPrefix,
} from "@/lib/data";
import { loadRawGarden } from "@/lib/store";
import { beansForPlantDeep, podsForPlantSorted } from "@/lib/plant-hub";
import { filterSproutEntries } from "@/lib/sprouts";
import { narrativeExcerpt } from "@/lib/narrative-excerpt";
import { narrativeHref } from "@/lib/plant-path";
import { PlantHero } from "../../../_components/plant-hero";
import { PlantRail } from "../../../_components/plant-rail";
import { ExhibitionPanel, type ExhibitionPanelRow } from "../../../_components/exhibition-panel";
import { PlantMetaForm } from "../../../_components/plant-meta-form";
import { PlantRoleForm } from "../../../_components/plant-role-form";
import { PlantLogoForm } from "../../../_components/plant-logo-form";
import { PreviewPanel } from "../../../_components/preview-panel";
import { NarrativePreview } from "../../../_components/narrative-preview";
import { PodTable, type PodRow } from "../../../_components/pod-table";
import { BeanTable, type BeanRow } from "../../../_components/bean-table";
import { SproutTable } from "../../../_components/sprout-table";
import { ScreenThumbs, type ThumbItem } from "../../../_components/screen-thumbs";
import { roleParts } from "@/lib/plant-role";
import { statusOf } from "@/lib/plant-status";
import { visibilityOf } from "@/lib/plant-visibility";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

/** How many rows a preview draws before deferring to its section. */
const PREVIEW_ROWS = 5;

/** How many thumbnails the screens preview draws — one row of the grid. */
const PREVIEW_SCREENS = 4;

/**
 * A plant, as its HUB.
 *
 * The mark, the name and three icons are the whole header; each editor is one
 * click behind the thing it edits (the logo behind the logo, meta behind the
 * title, the role behind the crown), and the two enum fields open their
 * vocabulary as radios and commit on a separate Save — never on the click that
 * opens them.
 *
 * Below that, the page is a DIRECTORY and nothing else: five sections, each
 * the full width of the column, each a heading and a way out. Four of them are
 * what the plant contains — the three tiers under a plant, then its screens —
 * and the first is the plant's own narrative, as an excerpt.
 *
 * **The narrative is an excerpt here because the editor has a page now**
 * (`narrative/page.tsx`). It used to sit between the header and the previews:
 * a caret in the middle of a list, and the heaviest thing on a page whose
 * other five-sixths are static tables — mounted on every visit, including the
 * overwhelming majority spent looking for a sprout. What is left is two
 * clamped lines and `edit →`.
 *
 * The three tiers are drawn by the very component their section draws
 * (`PodTable`, `BeanTable`, `SproutTable`) with a row limit and no plant
 * column, since this page is already inside a plant; the screens are
 * `ScreenThumbs`, which is NOT the library's tiles, for the reason that file
 * gives. Each heading carries the FULL count and links into its section
 * pre-filtered by `?plant=`, so the preview is an entry point and never a
 * second, shorter truth: the page shows five and says how many there are, and
 * the section it points at narrows by the same rule this page counted with.
 * For beans that rule is `beansForPlantDeep`, the one function both sides
 * call, which is why the hub's number and `/admin/beans?plant=`'s number
 * cannot drift.
 *
 * The sections STACK. They were two columns on `lg` for one slice, which put a
 * table of a name, a glyph and two counts into half of the reading measure —
 * about 300px — to save vertical space on a page that had none to save.
 *
 * This replaced a floating "Inside" panel that listed the plant's pods and
 * beans one click behind an icon, because the page had nowhere in the document
 * to put them. It has one now. What stayed on the rail is the Exhibition
 * panel, which reorders the strip — the one thing a preview cannot do.
 */
export default async function AdminPlantPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; form?: string }>;
}) {
  const { slug } = await params;
  const { error, form } = await searchParams;

  const raw = await loadRawGarden();
  const plant = raw.plants?.find((p) => p.slug === slug);
  if (!plant) notFound();

  const dataset = buildDataset(raw);

  // The four sets, at FULL length. Each preview slices for display and reports
  // `count` from the length here — `PreviewPanel`'s docblock is explicit that
  // passing the drawn length instead renders "Pods (5) · all 5 →" over a
  // garden of forty, and promises a link that goes nowhere new.
  const pods = podsForPlantSorted(dataset, slug);
  const beans = beansForPlantDeep(dataset, slug);
  const sprouts = filterSproutEntries(dataset.timelineSprouts(), { plant: slug });

  // Built exactly as `/admin/pods` and `/admin/beans` build theirs, minus the
  // plant mark: `showPlant={false}` below drops that column, and a mark
  // computed for a column nobody draws is work done to be thrown away.
  const podRows: PodRow[] = pods.map((pod) => ({
    slug: pod.slug,
    name: resolveText(pod.name),
    visibility: pod.visibility ?? "public",
    hasNarrative: hasNarrative(pod.content),
    beanCount: dataset.beansForPod(pod.slug).length,
  }));

  const beanRows: BeanRow[] = beans.map((bean) => {
    const podSlug = parentsWithPrefix(bean.parents, POD_PREFIX)[0];
    return {
      slug: bean.slug,
      name: resolveText(bean.name),
      visibility: bean.visibility ?? "public",
      sproutCount: dataset.sproutsForBean(bean.slug).length,
      ...(podSlug ? { pod: podSlug } : {}),
    };
  });

  // The plant's screens, from the garden already loaded. Every screen it has —
  // the preview counts them, and the rail needs to know whether to appear at
  // all — and the exhibited ones, in strip order, from `dataset` rather than a
  // second `exhibitionOf` narrowing: `buildDataset` already builds this exact
  // index (`exhibitionForPlant`), filtered by `exhibited === true` and sorted
  // by `exhibitionOrder`, and its one extra guard — the plant must resolve —
  // is already true here, since `notFound()` above already required it.
  const plantScreens = (raw.screens ?? []).filter((s) =>
    parentsWithPrefix(s.parents, PLANT_PREFIX).includes(slug),
  );
  const exhibitionRows: ExhibitionPanelRow[] = dataset.exhibitionForPlant(slug).map((s) => ({
    slug: s.slug,
    name: resolveText(s.name),
    url: s.image.url,
    alt: s.image.alt ?? "",
  }));
  const thumbItems: ThumbItem[] = plantScreens.slice(0, PREVIEW_SCREENS).map((s) => ({
    slug: s.slug,
    name: resolveText(s.name),
    url: s.image.url,
    alt: s.image.alt ?? "",
  }));

  // One query string, four hrefs. `encodeURIComponent` because a slug is not
  // guaranteed to be URL-safe, and this is the same spelling `navHref` and
  // `scopeHref` use — the scope a preview hands to a section is the scope the
  // chrome would have handed it.
  const scopeQuery = `?plant=${encodeURIComponent(slug)}`;

  // The narrative, as one line. STRICT textPart, the same read as the
  // narrative editor's English half — `resolveText` would preview the fr half
  // over an editor holding the empty en one, which is a hub that says the
  // narrative is written when it is not.
  const excerpt = narrativeExcerpt(textPart(plant.content, "en"));

  const { label, title } = roleParts(plant.role);
  // Which sheet a rejected save came from — narrowed here rather than trusted:
  // the value reaches the client as a union, and an unknown ?form= opens
  // nothing and falls through to the page-level banner below.
  const errorForm = form === "meta" || form === "role" ? form : undefined;

  return (
    // PlantRail wraps the WHOLE body: its panel floats over the page and the
    // page slides out from under it, so what slides has to be everything — a
    // header that stayed put while the sections moved would read as a glitch
    // rather than as a nudge.
    <PlantRail
      // One prop carrying both the trigger's count and the popover's
      // server-rendered contents, so the two cannot disagree. Absent when the
      // plant has no screens at all: a rail icon opening onto "nothing to
      // see" is a control that only ever says no.
      exhibition={
        plantScreens.length > 0
          ? {
              count: exhibitionRows.length,
              panel: <ExhibitionPanel plantSlug={slug} rows={exhibitionRows} />,
            }
          : undefined
      }
    >
      <article className="flex flex-col gap-10">
        <PlantHero
          slug={plant.slug}
          name={resolveText(plant.name)}
          description={resolveText(plant.description ?? "").trim()}
          logoUrl={plant.logo?.url}
          status={statusOf(plant)}
          visibility={visibilityOf(plant)}
          role={{
            kind: plant.role.kind,
            label,
            title,
            detail: resolveText(plant.role.detail ?? "").trim(),
          }}
          error={error}
          errorForm={errorForm}
          metaForm={<PlantMetaForm plant={plant} />}
          roleForm={<PlantRoleForm plant={plant} />}
          logoForm={<PlantLogoForm plant={plant} />}
          // Everything the three editors can write, as stored. The hero closes
          // a sheet when this changes — the only honest signal a soft-navigating
          // save landed. STRICT textPart on both halves, so an fr-only edit
          // still moves the fingerprint (resolveText would fall back and hide
          // it).
          saved={JSON.stringify([
            textPart(plant.name, "en"),
            textPart(plant.name, "fr"),
            textPart(plant.description, "en"),
            textPart(plant.description, "fr"),
            plant.role,
            plant.logo?.url ?? null,
          ])}
        />

        {/* Only an error no sheet will show: the hero reopens the sheet a
            rejected meta or role save came from and renders the message inside
            it, so repeating it here would say it twice. */}
        {error && !errorForm ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {/* Full width, stacked, in tier order — pods hold beans, beans hold
            sprouts — with the narrative first (the plant's own words before it
            is a container of anything) and screens last (the only one of the
            five that is not a tier of the content model). */}
        <div className="flex flex-col gap-10">
          <NarrativePreview excerpt={excerpt} href={narrativeHref(plant.slug)} />

          <PreviewPanel title="Pods" count={pods.length} allHref={`/admin/pods${scopeQuery}`}>
            <PodTable rows={podRows} limit={PREVIEW_ROWS} showPlant={false} />
          </PreviewPanel>

          <PreviewPanel title="Beans" count={beans.length} allHref={`/admin/beans${scopeQuery}`}>
            <BeanTable rows={beanRows} limit={PREVIEW_ROWS} showPlant={false} />
          </PreviewPanel>

          <PreviewPanel
            title="Sprouts"
            count={sprouts.length}
            allHref={`/admin/sprouts${scopeQuery}`}
          >
            <SproutTable entries={sprouts} limit={PREVIEW_ROWS} showPlant={false} />
          </PreviewPanel>

          {/* The one preview whose count and whose section can disagree:
              `plantScreens` above matches ANY plant parent, while
              `/admin/screens?plant=` narrows on the FIRST one (`screenRows` in
              lib/screens.ts). So a screen parented to two plants is counted on
              both hubs and listed under only one, and `all n →` would land on
              fewer rows than the heading promised. No screen in the garden has
              two plant parents today, and the create form cannot make one — if
              that ever changes, the two sides have to be made to agree here
              and there, not papered over on one side. */}
          <PreviewPanel
            title="Screens"
            count={plantScreens.length}
            allHref={`/admin/screens${scopeQuery}`}
          >
            <ScreenThumbs items={thumbItems} />
          </PreviewPanel>
        </div>
      </article>
    </PlantRail>
  );
}
