import { notFound } from "next/navigation";
import { resolveText } from "@/lib/data";
import { getFullDataset } from "@/lib/store";
import { beanDetail, type BeanDetailView } from "@/lib/bean-detail";
import { beanCoverFor } from "@/lib/bean-cover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BeanCoverForm } from "@/app/admin/_components/bean-cover-form";
import { BeanKeywordForm } from "@/app/admin/_components/bean-keyword-form";

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

  /* The keyword is drawn ONLY on the phone treatment, and only an explicit
     PORTRAIT cover reaches it. A landscape screenshot with a keyword typed
     under it is a silent no-op, so the Keyword card says so rather than
     letting the author guess.

     Asked of beanCoverFor rather than re-derived here — portrait-ness is
     lib/bean-cover.ts's rule and stays there. The empty sprouts array is safe
     because an explicit cover short-circuits the derivation, and the
     Boolean(bean.cover) guard is what makes that true: with no explicit cover
     there is nothing to warn about and no hint. Not validation — a keyword on
     a wordless cover still saves (lib/bean-keyword.ts throws nothing), and an
     author may well set the word before the screenshot. */
  const coverIsWordless = Boolean(bean.cover) && beanCoverFor(bean, [])?.kind !== "phone";

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

        {/* The page's first write surface — it was a read-only property dump
            until this slice. Two cards, because they are two forms: see
            bean-cover-form.tsx for why they cannot be one.

            Gated on !bean.projected. lib/data.ts's own declaration of the
            field already says a projected bean is "read-only in the admin,
            source-owned, rebuildable" — the Alert above states exactly that —
            so rendering live write forms under it would contradict the page's
            own banner. It is not only cosmetic: lib/pollen-store.ts's
            deleteFeedData does `deleteMany({ "projected.feedId": feedId })`
            on a full rebuild, which deletes the bean document — and any
            authored cover or keyword with it. The ordinary sync path is
            safe (upsert uses `$setOnInsert`, so an authored or
            previously-synced bean always wins over the feed); the loss is
            only on a deliberate full rebuild, which is exactly what the
            banner above warns about. */}
        {!bean.projected ? (
          <section className="flex flex-col gap-4">
            <h2 className="font-heading text-lg tracking-tight">Cover</h2>
            <Card>
              <CardContent>
                <BeanCoverForm bean={bean} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-3">
                <BeanKeywordForm bean={bean} />
                {coverIsWordless ? (
                  <p className="text-sm text-muted-foreground">
                    This cover isn&apos;t phone-shaped, so the word won&apos;t be drawn — it
                    shows only on a portrait cover. Saved either way.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </section>
        ) : null}

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
