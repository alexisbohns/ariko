import { notFound } from "next/navigation";
import { buildDataset, resolveText } from "@/lib/data";
import { editLang, editLangHrefs, editorHalves } from "@/lib/edit-lang";
import { entityOptions } from "@/lib/entity-options";
import { visibilityOf } from "@/lib/plant-visibility";
import { loadRawGarden } from "@/lib/store";
import { editContainerContentAction } from "../../../actions";
import { EntityRail } from "../../../_components/entity-rail";
import { PodVisibility } from "../../../_components/pod-visibility";
import { PlantHeader } from "@/components/plant-header";
import { ProseEditor } from "@/components/editor/prose-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { resolveLineage, ADMIN_HREFS } from "@/lib/lineage";
import { LineageChrome } from "@/components/lineage-chrome";

export const dynamic = "force-dynamic";

/**
 * One pod, as a place you come to in order to WRITE.
 *
 * The sprout page's shape, one tier up: the shared head, a bare editor whose
 * commit floats, and the pod's own facts behind the head. It used to be two
 * cards — the editor inside a `ContentCard`, so a bordered writing surface
 * inside a bordered card, and the beans inside another — which drew a frame
 * around a page whose only job is the prose. `bare` and `float` are the other
 * editors' answer to exactly that, and the list of beans is a plain section,
 * as the bean page's sprouts are.
 *
 * The pod has no meta form of its own, so unlike the sprout head this one
 * states its name and description rather than opening a sheet behind them;
 * visibility is the one fact it edits, through `PodVisibility`.
 *
 * `loadRawGarden`, never the cached reader — this page loads stored markdown
 * into an editor and posts it back, so a cached read is an author saving a
 * stale body over a newer one. The load goes through `editorHalves`, STRICT per
 * half, so neither half is ever loaded into the other's editor.
 */
export default async function AdminPodPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; form?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const { error, form } = query;
  // A rejected visibility save names its surface, and the message renders
  // inside the reopened popover rather than in the banner below.
  const visibilityError = form === "visibility" ? error : undefined;
  const lang = editLang(query.lang);

  const raw = await loadRawGarden();
  const pod = raw.pods?.find((p) => p.slug === slug);
  if (!pod) notFound();

  const beans = buildDataset(raw).beansForPod(slug);
  const ref = `pod:${pod.slug}`;

  // The LIVE garden — already loaded above, per CLAUDE.md's garden rule: the
  // admin reads live, and the chrome is the surface most likely to be looked at
  // right after a rename. "en": the admin zone is authored in one language.
  const lineage = resolveLineage(pod.parents, raw, { lang: "en", hrefs: ADMIN_HREFS });

  return (
    <>
      <LineageChrome lineage={lineage} as={Link} />
      {/* A rail with no items: no cluster draws, but the editor's staging
          blocks open their forms in its panel (spec 2026-11-15 §11). */}
      <EntityRail label="Pod panels" items={[]}>
        <article className="flex flex-col gap-8">
          <PlantHeader
            /* No mark. See components/plant-header.tsx's prop comment: a pod has
               no logo, and absent is a statement about the entity. */
            title={resolveText(pod.name)}
            description={resolveText(pod.description ?? "").trim()}
            facts={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge variant="outline">pod:{pod.slug}</Badge>
                <PodVisibility
                  slug={pod.slug}
                  visibility={visibilityOf(pod)}
                  error={visibilityError}
                  lang={lang}
                />
              </div>
            }
          />

          {error && !visibilityError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {/* No ContentCard: a card around an editor that is the page's only
              content is a frame around the page. */}
          <ProseEditor
            key={lang}
            bare
            float
            {...editorHalves(pod.content, lang)}
            langSwitch={{
              current: lang,
              hrefs: editLangHrefs(`/admin/pod/${encodeURIComponent(pod.slug)}`, query),
            }}
            entities={entityOptions(raw, ref)}
            action={editContainerContentAction}
            hidden={{ ref, lang }}
          />

          <section className="flex flex-col gap-4">
            <h2 className="font-heading text-lg tracking-tight">
              Inside <span className="text-muted-foreground">({beans.length})</span>
            </h2>
            {beans.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {beans.map((bean) => (
                  <li key={bean.slug}>
                    <Link href={`/admin/bean/${bean.slug}`} className="underline-offset-4 hover:underline">
                      {resolveText(bean.name)}
                    </Link>{" "}
                    <span className="font-heading text-xs text-muted-foreground">bean:{bean.slug}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </article>
      </EntityRail>
    </>
  );
}
