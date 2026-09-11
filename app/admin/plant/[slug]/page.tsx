import { notFound } from "next/navigation";
import { buildDataset, resolveText, textPart, PLANT_PREFIX, parentsWithPrefix } from "@/lib/data";
import { loadRawGarden } from "@/lib/store";
import { entityOptions } from "@/lib/entity-options";
import { editContainerContentAction } from "../../actions";
import { PlantHero } from "../../_components/plant-hero";
import { PlantInside, type InsideItem } from "../../_components/plant-inside";
import { ExhibitionPanel, type ExhibitionPanelRow } from "../../_components/exhibition-panel";
import { PlantMetaForm } from "../../_components/plant-meta-form";
import { PlantRoleForm } from "../../_components/plant-role-form";
import { PlantLogoForm } from "../../_components/plant-logo-form";
import { ProseEditor } from "@/components/editor/prose-editor";
import { roleParts } from "@/lib/plant-role";
import { statusOf } from "@/lib/plant-status";
import { visibilityOf } from "@/lib/plant-visibility";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

/**
 * A plant, as one page rather than as five stacked cards.
 *
 * The mark, the name and three icons are the whole header; each editor is one
 * click behind the thing it edits (the logo behind the logo, meta behind the
 * title, the role behind the crown), and the two enum fields open their
 * vocabulary as radios and commit on a separate Save — never on the click that
 * opens them. What is left in the column is the prose — unboxed,
 * because it is the page's actual content and a card around it was a frame
 * around the only thing worth looking at. The index of pods and beans moved to
 * a floating panel on a right-hand rail, where it costs the page nothing until
 * it is asked for.
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
  const inside: InsideItem[] = [
    ...dataset.podsForPlant(slug).map((pod) => ({
      href: `/admin/pod/${pod.slug}`,
      name: resolveText(pod.name),
      ref: `pod:${pod.slug}`,
    })),
    ...dataset.beansForPlant(slug).map((bean) => ({
      href: `/admin/bean/${bean.slug}`,
      name: resolveText(bean.name),
      ref: `bean:${bean.slug}`,
    })),
  ];

  // The plant's screens, from the garden already loaded. Every screen it has —
  // the panel needs the count to decide whether the rail shows a second icon at
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

  const { label, title } = roleParts(plant.role);
  // Which sheet a rejected save came from — narrowed here rather than trusted:
  // the value reaches the client as a union, and an unknown ?form= opens
  // nothing and falls through to the page-level banner below.
  const errorForm = form === "meta" || form === "role" ? form : undefined;

  return (
    // PlantInside wraps the WHOLE body, not just the editor: its panel floats
    // over the page and the page slides out from under it, so what slides has
    // to be everything — a header that stayed put while the prose moved would
    // read as a glitch rather than as a nudge.
    <PlantInside
      items={inside}
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
          href="/admin/garden"
          className="self-start text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          ← garden
        </a>

        <PlantHero
          slug={plant.slug}
          name={resolveText(plant.name)}
          description={resolveText(plant.description ?? "").trim()}
          logoUrl={plant.logo?.url}
          status={statusOf(plant)}
          visibility={visibilityOf(plant)}
          role={{ label, title, detail: resolveText(plant.role.detail ?? "").trim() }}
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
      </article>
    </PlantInside>
  );
}
