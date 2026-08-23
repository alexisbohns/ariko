import { notFound } from "next/navigation";
import { buildDataset, resolveText } from "@/lib/data";
import { loadRawGarden } from "@/lib/store";
import { editContainerContentAction } from "../../actions";
import { AdminBar } from "../../_components/admin-bar";
import { ContentCard } from "../../_components/content-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminPodPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;

  const raw = await loadRawGarden();
  const pod = raw.pods?.find((p) => p.slug === slug);
  if (!pod) notFound();

  const beans = buildDataset(raw).beansForPod(slug);

  return (
    <article>
      <AdminBar current="/admin/garden" />

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <a
            href="/admin/garden"
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            ← garden
          </a>
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            {resolveText(pod.name)}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">pod:{pod.slug}</Badge>
            <Badge variant={pod.visibility === "public" ? "default" : "secondary"}>
              {pod.visibility ?? "public"}
            </Badge>
          </div>
          {resolveText(pod.description ?? "").trim() ? (
            <p className="text-sm text-muted-foreground">{resolveText(pod.description)}</p>
          ) : null}
        </div>

        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <ContentCard
          raw={raw}
          content={pod.content}
          selfRef={`pod:${pod.slug}`}
          action={editContainerContentAction}
          hidden={{ ref: `pod:${pod.slug}` }}
        />

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base tracking-tight">Inside</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {beans.map((bean) => (
                <li key={bean.slug}>
                  <a href={`/admin/bean/${bean.slug}`} className="underline-offset-4 hover:underline">
                    {resolveText(bean.name)}
                  </a>{" "}
                  <span className="font-heading text-xs text-muted-foreground">bean:{bean.slug}</span>
                </li>
              ))}
              {beans.length === 0 ? <li className="text-muted-foreground">nothing yet</li> : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </article>
  );
}
