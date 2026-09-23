import { notFound } from "next/navigation";
import { resolveText } from "@/lib/data";
import { editLang, editLangHrefs, editorHalves } from "@/lib/edit-lang";
import { loadRawGarden } from "@/lib/store";
import { entityOptions } from "@/lib/entity-options";
import { hubHref, narrativeHref } from "@/lib/plant-path";
import { editContainerContentAction } from "../../../../actions";
import { ProseEditor } from "@/components/editor/prose-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

/**
 * A plant's NARRATIVE — the editor, and nothing else.
 *
 * It used to be the middle of the hub, between the header and the four
 * previews: an editor on a page that is otherwise a directory, and the
 * heaviest thing on it. The hub is a place you pass through to find a sprout;
 * this is a place you come to in order to write. Splitting them is what lets
 * each be one thing, and it is why the hub now draws an EXCERPT (see
 * `NarrativePreview`) rather than a caret.
 *
 * **The admin's first hub child route.** `lib/plant-path.ts` was written for
 * this day: `plantSlugFromPath` truncates `/admin/plant/<slug>/narrative` to
 * the slug, so the rail keeps lighting Overview and the plant switcher keeps
 * naming this plant, with nothing to change in `resolveNavItem` or
 * `resolveScope`. `lib/admin-nav.test.ts` pins both halves against this exact
 * path, so the first real child route is also the thing that proves the claim.
 *
 * No `PlantHero` and no `PlantRail`. The hero's five editors belong to the hub
 * — drawing them here would give the plant two places to rename itself and two
 * visibility toggles to keep in agreement — and the rail's one panel reorders
 * the exhibition strip, which has nothing to do with prose. The eyebrow, the
 * name and one link back are the whole chrome this page needs.
 *
 * `loadRawGarden`, never the cached reader: this page loads stored markdown
 * into an editor and posts it back, so a cached read is not a slow page, it is
 * an author saving a stale body over a newer one.
 */
export default async function AdminPlantNarrativePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const { error } = query;
  const lang = editLang(query.lang);

  const raw = await loadRawGarden();
  const plant = raw.plants?.find((p) => p.slug === slug);
  if (!plant) notFound();

  const name = resolveText(plant.name);
  const ref = `plant:${plant.slug}`;

  return (
    <article className="flex flex-col gap-8">
      <a
        href={hubHref(plant.slug)}
        className="self-start text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        ← {name}
      </a>

      <div className="flex flex-col gap-1">
        <p className="font-heading text-xs uppercase tracking-[0.15em] text-muted-foreground">
          Narrative
        </p>
        <h1 className="font-heading text-2xl font-medium tracking-tight">{name}</h1>
      </div>

      {/* The content action's only rejection path. It redirects HERE now
          (`narrativeHref`, app/admin/actions.ts), because here is where the
          editor lives — a banner on the hub would describe an edit made on a
          page the author had already left. */}
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Moved from the hub verbatim, `bare` included: this page IS the frame,
          so a card around the editor would be a frame around the only thing on
          it. The load goes through `editorHalves` — STRICT per half, so
          neither half is ever loaded into the other's editor. */}
      <ProseEditor
        key={lang}
        bare
        {...editorHalves(plant.content, lang)}
        langSwitch={{ current: lang, hrefs: editLangHrefs(narrativeHref(plant.slug), query) }}
        entities={entityOptions(raw, ref)}
        action={editContainerContentAction}
        hidden={{ ref, lang }}
      />
    </article>
  );
}
