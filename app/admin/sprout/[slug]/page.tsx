import { notFound } from "next/navigation";
import { buildDataset, resolveText, textPart } from "@/lib/data";
import { getSprout } from "@/lib/botanical";
import { editVersionAction, deleteVersionAction, editContentAction, editSproutMediaAction } from "../../actions";
import { ContentCard } from "../../_components/content-card";
import { MediaPicker } from "@/components/admin/media-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceLabel, NativeCheckbox, NativeRadio } from "@/components/ui/native-controls";
import { Prose } from "@/components/markdown";
import { loadRawGarden } from "@/lib/store";
import { resolveEntity } from "@/lib/entity-resolve";

export const dynamic = "force-dynamic";

const ATOM_PREFIX = "bean:";

export default async function EditVersionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;

  const version = await getSprout(slug);
  if (!version) notFound();

  const beanSlug = (version.parents ?? [])
    .filter((p) => p.startsWith(ATOM_PREFIX))
    .map((p) => p.slice(ATOM_PREFIX.length))[0];
  const backHref = beanSlug ? `/admin/bean/${beanSlug}` : "/admin/vault";
  const content = resolveText(version.content);
  // The FULL dataset: in the authoring zone a ref to a draft or private entity
  // should resolve and be visible, not vanish the way it does in public. Load
  // the raw garden once and derive the dataset from it — getFullDataset() is
  // literally buildDataset(await loadRawGarden()), so this is the same single
  // database read; it just keeps the raw garden the entity picker needs.
  const raw = await loadRawGarden();
  const dataset = buildDataset(raw);

  return (
    <article>

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <a
            href={backHref}
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            ← back
          </a>
          <h1 className="font-heading text-2xl font-medium tracking-tight">Edit version</h1>
          <ul className="flex flex-col gap-1 font-heading text-xs">
            <li className="flex gap-2">
              <span className="w-16 shrink-0 text-muted-foreground">slug</span>
              <span>{version.slug}</span>
            </li>
            <li className="flex gap-2">
              <span className="w-16 shrink-0 text-muted-foreground">bean</span>
              <span>{beanSlug ?? "—"}</span>
            </li>
          </ul>
        </div>

        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {content ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base tracking-tight">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <Prose
                content={version.content}
                resolve={(ref) => resolveEntity(dataset, ref)}
                showUnresolved
              />
            </CardContent>
          </Card>
        ) : null}

        <ContentCard
          raw={raw}
          content={version.content}
          selfRef={`sprout:${version.slug}`}
          action={editContentAction}
          hidden={{ slug: version.slug }}
        />

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base tracking-tight">Media</CardTitle>
            {/* Order is load-bearing and its consequence is invisible from here:
                the first image becomes the bean's public cover. Saying so on
                screen, not only in a comment, is the difference between an
                authoring act and an accident. */}
            <CardDescription className="text-xs">
              The first image becomes this bean&apos;s cover.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Its own form — not part of the metadata form below, and not part
                of the content form above. A bean's cover is the FIRST image in
                this list (spec §5.5), so the order here is an authoring act. */}
            <form action={editSproutMediaAction} className="flex flex-col gap-4">
              <input type="hidden" name="slug" value={version.slug} />
              {/* The key re-seeds the island after a save. MediaPicker reads
                  `initial` ONCE, in its useState initializer, so without this
                  React reconciles the same instance after the action redirects
                  and the picker keeps showing its own local state — including a
                  just-added link still carrying provider:"" where the server has
                  since derived the real one. Re-saving is idempotent
                  (parseMediaField re-derives), so this is not a correctness bug;
                  the picker should simply show what the database actually holds. */}
              {/* submitLabel, so the button is rendered BY the island rather
                  than around it: this form's entire meaningful content is the
                  picker, and a server-rendered button would let a script-off
                  browser submit a form carrying nothing. Now script-off sees no
                  button at all and the form is simply not operable — which is
                  what CLAUDE.md's "no capture or edit ever depends on it"
                  actually asserts. */}
              <MediaPicker
                key={JSON.stringify(version.media ?? [])}
                name="media"
                initial={version.media ?? []}
                links
                submitLabel="Save media"
              />
            </form>
          </CardContent>
        </Card>

        {content ? (
          <Card>
            <CardContent>
              {/* Read-only, zero JS, collapsed. The editor is the authoring surface;
                  this stays as the diagnostic for when the two markdown parsers
                  disagree (spec §5). */}
              <details>
                <summary className="cursor-pointer font-heading text-sm text-muted-foreground">
                  Source
                </summary>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 font-heading text-xs whitespace-pre-wrap">
                  {content}
                </pre>
              </details>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent>
            <form action={editVersionAction} className="flex flex-col gap-4">
              <input type="hidden" name="slug" value={version.slug} />
              {/* Prefills use the STRICT textPart — resolveText's fallback would copy en
                  into the fr box and corrupt the data on save. The name inputs carry no
                  `required`: the name is required as a whole (either language), enforced
                  server-side, and an fr-only name is valid. */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    name="name"
                    defaultValue={textPart(version.name, "en")}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="nameFr">Name (fr)</Label>
                  <Input
                    id="nameFr"
                    type="text"
                    name="nameFr"
                    defaultValue={textPart(version.name, "fr")}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="type">Type</Label>
                  <Input id="type" type="text" name="type" defaultValue={version.type} required />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" name="date" defaultValue={version.date} required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={textPart(version.description, "en")}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="descriptionFr">Description (fr)</Label>
                  <Textarea
                    id="descriptionFr"
                    name="descriptionFr"
                    defaultValue={textPart(version.description, "fr")}
                  />
                </div>
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">State</legend>
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <ChoiceLabel>
                    <NativeRadio
                      name="state"
                      value="draft"
                      defaultChecked={version.state === "draft" || version.state == null}
                    />{" "}
                    draft
                  </ChoiceLabel>
                  <ChoiceLabel>
                    <NativeRadio
                      name="state"
                      value="private"
                      defaultChecked={version.state === "private"}
                    />{" "}
                    private
                  </ChoiceLabel>
                  <ChoiceLabel>
                    <NativeRadio
                      name="state"
                      value="published"
                      defaultChecked={version.state === "published"}
                    />{" "}
                    published
                  </ChoiceLabel>
                </div>
              </fieldset>
              <div>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="ring-destructive/30">
          <CardHeader>
            <CardTitle className="font-heading text-base tracking-tight text-destructive">
              Danger zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={deleteVersionAction} className="flex flex-col gap-4">
              <input type="hidden" name="slug" value={version.slug} />
              <ChoiceLabel className="items-start leading-normal">
                <NativeCheckbox name="confirm" required className="mt-0.5" />
                <span>
                  Yes, permanently delete the version “{resolveText(version.name)}” — this cannot
                  be undone.
                </span>
              </ChoiceLabel>
              <div>
                <Button type="submit" variant="destructive">
                  Delete version
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </article>
  );
}
