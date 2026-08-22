import { notFound } from "next/navigation";
import { getSeed } from "@/lib/seeds";
import { listPlants, listPods, listBeans } from "@/lib/botanical";
import { resolveText, textPart } from "@/lib/data";
import { promoteSeedAction, discardSeedAction } from "../../actions";
import { AdminBar } from "../../_components/admin-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceLabel, NativeRadio, NativeSelect } from "@/components/ui/native-controls";

export const dynamic = "force-dynamic";

/** A titled block of the promote form. */
function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <legend className="px-1 font-heading text-xs uppercase tracking-widest text-muted-foreground">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

export default async function TriagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const seed = await getSeed(id);
  if (!seed || seed.status !== "inbox") notFound();

  const [plants, pods, beans] = await Promise.all([listPlants(), listPods(), listBeans()]);
  const note = resolveText(seed.body);

  return (
    <article>
      <AdminBar current="/admin" />

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <a
            href="/admin"
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            ← inbox
          </a>
          <h1 className="font-heading text-2xl font-medium tracking-tight">Triage</h1>
        </div>

        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>Could not promote: {error}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base tracking-tight">
              {resolveText(seed.title)}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {note ? <p className="text-sm">{note}</p> : null}
            <ul className="flex flex-col gap-1 font-heading text-xs">
              <li className="flex gap-2">
                <span className="w-20 shrink-0 text-muted-foreground">source</span>
                <span>{seed.source.kind}</span>
              </li>
              {seed.suggested ? (
                <li className="flex gap-2">
                  <span className="w-20 shrink-0 text-muted-foreground">suggested</span>
                  <span>
                    {[
                      seed.suggested.plantSlug && `plant ${seed.suggested.plantSlug}`,
                      seed.suggested.podSlug && `pod ${seed.suggested.podSlug}`,
                      seed.suggested.beanSlug && `bean ${seed.suggested.beanSlug}`,
                      seed.suggested.type && `type ${seed.suggested.type}`,
                      seed.suggested.tags?.length ? `tags ${seed.suggested.tags.join(", ")}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              ) : null}
              {seed.media.map((m, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-20 shrink-0 text-muted-foreground">{m.kind}</span>
                  <span className="min-w-0 break-all">{m.url}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <form action={promoteSeedAction} className="flex flex-col gap-6">
          <input type="hidden" name="seedId" value={seed.id} />

          <Fieldset legend="Plant">
            {/* Selecting a plant roots whichever parent is CREATED below: a new pod
                parents under it; a new bean with no pod parents directly under it. */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="plantSlug">Existing</Label>
              <NativeSelect
                id="plantSlug"
                name="plantSlug"
                defaultValue={seed.suggested?.plantSlug ?? ""}
              >
                <option value="">— none —</option>
                {plants.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.slug}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </Fieldset>

          <Fieldset legend="Pod">
            <div className="flex flex-col gap-2">
              <Label htmlFor="podSlug">Existing</Label>
              <NativeSelect id="podSlug" name="podSlug" defaultValue={seed.suggested?.podSlug ?? ""}>
                <option value="">— none —</option>
                {pods.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {m.slug}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="newPodSlug">New slug</Label>
                <Input id="newPodSlug" type="text" name="newPodSlug" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="newPodName">New name</Label>
                <Input id="newPodName" type="text" name="newPodName" />
              </div>
            </div>
          </Fieldset>

          <Fieldset legend="Bean">
            <div className="flex flex-col gap-2">
              <Label htmlFor="beanSlug">Existing</Label>
              <NativeSelect
                id="beanSlug"
                name="beanSlug"
                defaultValue={seed.suggested?.beanSlug ?? ""}
              >
                <option value="">— none —</option>
                {beans.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.slug}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="newBeanSlug">New slug</Label>
                <Input id="newBeanSlug" type="text" name="newBeanSlug" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="newBeanName">New name</Label>
                <Input id="newBeanName" type="text" name="newBeanName" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="newBeanNameFr">New name (fr)</Label>
                <Input id="newBeanNameFr" type="text" name="newBeanNameFr" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="newBeanDescription">New description</Label>
                <Input id="newBeanDescription" type="text" name="newBeanDescription" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="newBeanDescriptionFr">New description (fr)</Label>
                <Input id="newBeanDescriptionFr" type="text" name="newBeanDescriptionFr" />
              </div>
            </div>
          </Fieldset>

          <Fieldset legend="Sprout">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sproutSlug">Slug</Label>
              <Input id="sproutSlug" type="text" name="sproutSlug" required />
            </div>
            {/* Prefills use the STRICT textPart — resolveText's fallback would copy en
                into the fr box and corrupt the data on save. The name inputs carry no
                `required`: the name is required as a whole (either language), enforced
                server-side, and the builder falls back to the seed title. Blank
                description fields carry the seed's note verbatim on promote. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sproutName">Name</Label>
                <Input
                  id="sproutName"
                  type="text"
                  name="sproutName"
                  defaultValue={textPart(seed.title, "en")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sproutNameFr">Name (fr)</Label>
                <Input
                  id="sproutNameFr"
                  type="text"
                  name="sproutNameFr"
                  defaultValue={textPart(seed.title, "fr")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="type">Type</Label>
                <Input
                  id="type"
                  type="text"
                  name="type"
                  required
                  defaultValue={seed.suggested?.type ?? ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" name="date" required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={textPart(seed.body, "en")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="descriptionFr">Description (fr)</Label>
                <Textarea
                  id="descriptionFr"
                  name="descriptionFr"
                  defaultValue={textPart(seed.body, "fr")}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">State</span>
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <ChoiceLabel>
                  <NativeRadio name="state" value="draft" defaultChecked /> draft
                </ChoiceLabel>
                <ChoiceLabel>
                  <NativeRadio name="state" value="private" /> private
                </ChoiceLabel>
                <ChoiceLabel>
                  <NativeRadio name="state" value="published" /> published
                </ChoiceLabel>
              </div>
            </div>
          </Fieldset>

          <div>
            <Button type="submit">Promote</Button>
          </div>
        </form>

        <form action={discardSeedAction}>
          <input type="hidden" name="seedId" value={seed.id} />
          <Button type="submit" variant="ghost" size="sm">
            Discard
          </Button>
        </form>
      </div>
    </article>
  );
}
