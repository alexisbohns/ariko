import { notFound } from "next/navigation";
import { resolveText } from "@/lib/data";
import { getFullDataset } from "@/lib/store";
import { beanDetail, type BeanDetailView } from "@/lib/bean-detail";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

/** One `key / value` line of the property dump. */
function DumpRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

export default async function AdminBeanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  const { bean, plant, podParents, sprouts } = view;

  return (
    <article>

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <a
            href="/admin/vault"
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            ← vault
          </a>
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            {resolveText(bean.name)}
          </h1>
          {resolveText(bean.description ?? "").trim() ? (
            <p className="text-sm text-muted-foreground">{resolveText(bean.description)}</p>
          ) : null}
          {bean.projected ? (
            <Alert role="note">
              <AlertDescription>
                Projected from {bean.projected.source} (feed {bean.projected.feedId}) — read-only,
                rebuilt from the feed.
              </AlertDescription>
            </Alert>
          ) : null}
          <ul className="flex flex-col gap-1 font-heading text-xs">
            <DumpRow label="bean">{bean.slug}</DumpRow>
            <DumpRow label="visibility">{bean.visibility ?? "public (default)"}</DumpRow>
            <DumpRow label="plant">{plant ?? "—"}</DumpRow>
            <DumpRow label="pod">{podParents.join(", ") || "—"}</DumpRow>
            <DumpRow label="tags">{(bean.tags ?? []).join(", ") || "—"}</DumpRow>
          </ul>
        </div>

        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg tracking-tight">
            Versions <span className="text-muted-foreground">({sprouts.length})</span>
          </h2>
          {sprouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions.</p>
          ) : (
            sprouts.map((version) => (
              <Card key={version.slug}>
                <CardHeader>
                  <CardTitle className="font-heading text-base tracking-tight">
                    {resolveText(version.name)}
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{version.state ?? "—"}</Badge>
                    <a
                      href={`/admin/sprout/${version.slug}`}
                      className="text-sm underline-offset-4 transition-colors hover:underline"
                    >
                      edit
                    </a>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-1 font-heading text-xs">
                    {Object.entries(version)
                      .filter(([, value]) => isScalar(value))
                      .map(([key, value]) => (
                        <DumpRow key={key} label={key}>
                          {String(value)}
                        </DumpRow>
                      ))}
                    <DumpRow label="tags">{(version.tags ?? []).join(", ") || "—"}</DumpRow>
                  </ul>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>
    </article>
  );
}
