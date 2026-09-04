import { notFound } from "next/navigation";
import { buildDataset, resolveText } from "@/lib/data";
import { loadRawGarden } from "@/lib/store";
import { editContainerContentAction } from "../../actions";
import { ContentCard } from "../../_components/content-card";
import { RoleCard } from "../../_components/role-card";
import { MetaCard } from "../../_components/meta-card";
import { LogoCard } from "../../_components/logo-card";
import { roleLine } from "@/lib/plant-role";
import { statusLabel, statusOf } from "@/lib/plant-status";
import { cloudinaryThumb } from "@/lib/image-url";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminPlantPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;

  const raw = await loadRawGarden();
  const plant = raw.plants?.find((p) => p.slug === slug);
  if (!plant) notFound();

  const dataset = buildDataset(raw);
  const pods = dataset.podsForPlant(slug);
  const beans = dataset.beansForPlant(slug);

  return (
    <article>

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <a
            href="/admin/garden"
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            ← garden
          </a>
          <div className="flex items-center gap-3">
            {/* The mark as the admin will see it published, at the size the
                landing uses — so a crop that goes wrong is visible here rather
                than only in production. */}
            {plant.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cloudinaryThumb(plant.logo.url, { width: 96, height: 96 })}
                alt=""
                className="h-12 w-12 shrink-0 rounded-xl object-cover"
              />
            ) : null}
            <h1 className="font-heading text-2xl font-medium tracking-tight">
              {resolveText(plant.name)}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">plant:{plant.slug}</Badge>
            <Badge>{roleLine(plant.role)}</Badge>
            <Badge variant="secondary">{statusLabel(statusOf(plant))}</Badge>
            <Badge variant={plant.visibility === "public" ? "default" : "secondary"}>
              {plant.visibility ?? "public"}
            </Badge>
          </div>
          {resolveText(plant.description ?? "").trim() ? (
            <p className="text-sm text-muted-foreground">{resolveText(plant.description)}</p>
          ) : null}
        </div>

        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <MetaCard plant={plant} />

        <RoleCard plant={plant} />

        <LogoCard plant={plant} />

        <ContentCard
          raw={raw}
          content={plant.content}
          selfRef={`plant:${plant.slug}`}
          action={editContainerContentAction}
          hidden={{ ref: `plant:${plant.slug}` }}
        />

        {/* Mechanical: an index has no argument to make, so it takes no
            authoring (umbrella §9). */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base tracking-tight">Inside</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {pods.map((pod) => (
                <li key={pod.slug}>
                  <a href={`/admin/pod/${pod.slug}`} className="underline-offset-4 hover:underline">
                    {resolveText(pod.name)}
                  </a>{" "}
                  <span className="font-heading text-xs text-muted-foreground">pod:{pod.slug}</span>
                </li>
              ))}
              {beans.map((bean) => (
                <li key={bean.slug}>
                  <a href={`/admin/bean/${bean.slug}`} className="underline-offset-4 hover:underline">
                    {resolveText(bean.name)}
                  </a>{" "}
                  <span className="font-heading text-xs text-muted-foreground">bean:{bean.slug}</span>
                </li>
              ))}
              {pods.length === 0 && beans.length === 0 ? (
                <li className="text-muted-foreground">nothing yet</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </article>
  );
}
