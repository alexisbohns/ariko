import { notFound } from "next/navigation";
import {
  buildDataset,
  resolveText,
  textPart,
  PLANT_PREFIX,
  POD_PREFIX,
  parentsWithPrefix,
} from "@/lib/data";
import { loadRawGarden } from "@/lib/store";
import { entityOptions } from "@/lib/entity-options";
import { beansForPlantDeep, podsForPlantSorted } from "@/lib/plant-hub";
import { filterSproutEntries } from "@/lib/sprouts";
import { editContainerContentAction } from "../../actions";
import { PlantHero } from "../../_components/plant-hero";
import { PlantRail } from "../../_components/plant-rail";
import { ExhibitionPanel, type ExhibitionPanelRow } from "../../_components/exhibition-panel";
import { PlantMetaForm } from "../../_components/plant-meta-form";
import { PlantRoleForm } from "../../_components/plant-role-form";
import { PlantLogoForm } from "../../_components/plant-logo-form";
import { PreviewPanel } from "../../_components/preview-panel";
import { PodTable, type PodRow } from "../../_components/pod-table";
import { BeanTable, type BeanRow } from "../../_components/bean-table";
import { SproutTable } from "../../_components/sprout-table";
import { ScreenThumbs, type ThumbItem } from "../../_components/screen-thumbs";
import { ProseEditor } from "@/components/editor/prose-editor";
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
 * opens them. Below that is the prose — unboxed, because it is the page's
 * actual content and a card around it was a frame around the only thing worth
 * looking at.
 *
 * Below THAT is what the plant contains: four previews — the three tiers under
 * a plant, then its screens. The three tiers are drawn by the very component
 * their section draws (`PodTable`, `BeanTable`, `SproutTable`) with a row
 * limit and no plant column, since this page is already inside a plant; the
 * screens are `ScreenThumbs`, which is NOT the library's tiles, for the reason
 * that file gives. Each heading carries the FULL count and links into
 * its section pre-filtered by `?plant=`, so the preview is an entry point and
 * never a second, shorter truth: the page shows five and says how many there
 * are, and the section it points at narrows by the same rule this page counted
 * with. For beans that rule is `beansForPlantDeep`, the one function both
 * sides call, which is why the hub's number and `/admin/beans?plant=`'s number
 * cannot drift.
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
    hasNarrative: textPart(pod.content, "en").trim().length > 0,
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

  const { label, title } = roleParts(plant.role);
  // Which sheet a rejected save came from — narrowed here rather than trusted:
  // the value reaches the client as a union, and an unknown ?form= opens
  // nothing and falls through to the page-level banner below.
  const errorForm = form === "meta" || form === "role" ? form : undefined;

  return (
    // PlantRail wraps the WHOLE body, not just the editor: its panel floats
    // over the page and the page slides out from under it, so what slides has
    // to be everything — a header that stayed put while the prose moved would
    // read as a glitch rather than as a nudge.
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
        <a
          href="/admin"
          className="self-start text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          ← plants
        </a>

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

        {/* Unboxed twice over: no ContentCard around it (that component IS the
            card, and the pod and sprout pages still want it) and `bare`, so the
            editor draws no frame of its own either. Same editor, same server
            action, same STRICT textPart — resolveText's fallback would load the
            fr half into the editor and save it back as en. */}
        <ProseEditor
          bare
          initialMarkdown={textPart(plant.content, "en")}
          entities={entityOptions(raw, `plant:${plant.slug}`)}
          action={editContainerContentAction}
          hidden={{ ref: `plant:${plant.slug}` }}
        />

        {/* Two columns where there is room for two, one where there is not.
            The previews are in tier order — pods hold beans, beans hold
            sprouts — and screens last, because they are the only ones that are
            not a tier of the content model. */}
        <div className="grid gap-8 lg:grid-cols-2">
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
