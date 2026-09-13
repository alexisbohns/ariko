import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { resolveText, type Relation, type Text } from "@/lib/data";
import type { Lang } from "@/lib/locale";
import { currentLang } from "@/lib/locale-server";
import { getPublicDataset } from "@/lib/garden-cache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { articleFor } from "@/lib/article";
import { Prose } from "@/components/markdown";
import { resolveEntity } from "@/lib/entity-resolve";
import { MediaList } from "@/components/media";
import { LinkRow } from "@/components/link-row";
import { resolveLineage, PUBLIC_HREFS } from "@/lib/lineage";
import { LineageChrome } from "@/components/lineage-chrome";

export const dynamic = "force-dynamic";

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

// The property dump's display value: Text-typed model fields (name/description
// since B1) render resolved instead of dropping when localized; anything else
// renders only when scalar (null = omit the row). relations[] is handled
// separately (one row per edge), not here.
function displayValue(
  key: string,
  value: unknown,
  lang: Lang,
): string | number | boolean | null {
  if (key === "name" || key === "description") {
    // An empty resolution (blank string or degenerate {}) omits the row instead
    // of rendering a dangling "description:" line.
    return resolveText(value as Text, lang) || null;
  }
  return isScalar(value) ? value : null;
}

// One dump row per property — plus, for relations (G2), one row PER edge:
// "relation: kind → ref". The dataset is post-scrub (filterPublic), so every
// ref rendered here points at something public.
function dumpRows(sprout: Record<string, unknown>, lang: Lang): ReactNode[] {
  return Object.entries(sprout).flatMap(([key, value]) => {
    if (key === "relations" && Array.isArray(value)) {
      return (value as Relation[]).map((rel, i) => (
        <li key={`relation-${i}`} className="flex gap-2">
          <span className="shrink-0 text-muted-foreground">relation</span>
          <span>
            {rel.kind} → {rel.ref}
          </span>
        </li>
      ));
    }
    const display = displayValue(key, value, lang);
    if (display === null) return [];
    return [
      <li key={key} className="flex gap-2">
        <span className="shrink-0 text-muted-foreground">{key}</span>
        <span>{String(display)}</span>
      </li>,
    ];
  });
}

export default async function BeanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = await currentLang();
  const data = await getPublicDataset();
  const bean = data.getBean(id);
  if (!bean) notFound();

  const sprouts = data.sproutsForBean(bean.slug);
  // The newest published sprout carrying content (spec §4). Older sprouts stay
  // as the property-dump rows below — they have no public URL to link to yet.
  const article = articleFor(sprouts);

  // From the FILTERED dataset, so a private pod or plant is simply absent from
  // the trail — resolveLineage drops a ref it cannot resolve, which is the
  // privacy projection doing the work rather than a second check here.
  const lineage = resolveLineage(
    bean.parents,
    { plants: data.getPlants(), pods: data.getPods() },
    { lang, hrefs: PUBLIC_HREFS },
  );

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

      {sprouts.map((sprout) => (
        <Card key={sprout.slug}>
          <CardHeader>
            <CardTitle className="font-heading text-base tracking-tight">
              {resolveText(sprout.name, lang)}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-col gap-1 font-heading text-xs">{dumpRows(sprout, lang)}</ul>
            {/* Destinations before assets: "listen to this" is what a visitor
                came for, and the gallery is what they stay for. `links[]` needs
                no exclusion from the dump above — isScalar rejects arrays, so
                it stays out the same way media[] already does. */}
            <LinkRow links={sprout.links} lang={lang} label={`Listen to ${resolveText(sprout.name, lang)}`} />
            {/* One location, no duplication, and no layout bet the exhibition
                slice would overturn: the property dump stays until D1 retires
                it deliberately (umbrella §4), so media belongs beside it. */}
            <MediaList media={sprout.media} />
          </CardContent>
        </Card>
      ))}
      </article>
    </>
  );
}
