import { notFound } from "next/navigation";
import { resolveText, textPart } from "@/lib/data";
import { editLang, editLangHrefs, editorHalves } from "@/lib/edit-lang";
import { getSprout } from "@/lib/botanical";
import { loadRawGarden } from "@/lib/store";
import { entityOptions } from "@/lib/entity-options";
import { stateOf } from "@/lib/sprout-state";
import { editContentAction } from "../../../actions";
import { SproutHero, type Surface } from "../../../_components/sprout-hero";
import { SproutMetaForm } from "../../../_components/sprout-meta-form";
import { SproutMediaForm } from "../../../_components/sprout-media-form";
import { SproutDeleteForm } from "../../../_components/sprout-delete-form";
import { EntityRail, type RailItem } from "../../../_components/entity-rail";
// Not from lucide-react. `RailItem.icon` crosses into a client component and
// this file is a server one, so the icons have to arrive as client references —
// see _components/rail-icons.ts, which is the whole of that boundary.
import { FileCode2, Images, Trash2 } from "../../../_components/rail-icons";
import { ProseEditor } from "@/components/editor/prose-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { resolveLineage, ADMIN_HREFS } from "@/lib/lineage";
import { LineageChrome } from "@/components/lineage-chrome";

export const dynamic = "force-dynamic";

/**
 * One sprout, as a place you come to in order to WRITE.
 *
 * The sibling of `plant/[slug]/narrative/page.tsx` — a head, a bare editor, one
 * link back — with the difference that a sprout has no hub above it to carry
 * its fields, so its head carries them: the name in the h1 with the meta
 * overlay behind it, and state, date and type as three icons under it.
 *
 * WHAT LEFT THIS PAGE, and why each one left:
 *
 *  - The **Preview card**. The editor is a WYSIWYG over the same markdown
 *    `<Prose>` renders, so a preview beside it was a second rendering of the
 *    same bytes. The one place the two can genuinely disagree is the stored
 *    source, which is still here, on the rail.
 *  - The **metadata card** — seven fields in one form, at the bottom of a page
 *    whose subject is prose. Each field is now behind the thing it edits.
 *  - The **Source collapse**, the **Media card** and the **Danger zone**, all
 *    onto the rail: the first because it is a diagnostic and not a body, the
 *    second because a cover decision is not part of writing, the third because
 *    a delete does not belong in the flow of a document.
 *
 * `loadRawGarden`, never the cached reader — this page loads stored markdown
 * into an editor and posts it back, so a cached read is not a slow page, it is
 * an author saving a stale body over a newer one. It is also the UNFILTERED
 * garden on purpose: `entityOptions` offers every plant, pod and bean it holds,
 * because in the authoring zone a reference to a draft or private entity should
 * resolve and be visible, not vanish the way it does in public.
 */
export default async function AdminSproutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; form?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const { error, form } = query;
  const lang = editLang(query.lang);

  const sprout = await getSprout(slug);
  if (!sprout) notFound();

  const raw = await loadRawGarden();

  // The admin reads the LIVE garden — it already does, one line up — because the
  // chrome is the surface most likely to be looked at right after a rename.
  // "en" rather than a negotiated language: the admin zone is authored in one.
  const lineage = resolveLineage(sprout.parents, raw, { lang: "en", hrefs: ADMIN_HREFS });

  // What the editor opens on, and the half the rail's diagnostic shows. ONE
  // read serves both: with two, the Source panel could show one half while the
  // editor sat on the other — the diagnostic disagreeing with the surface it
  // exists to diagnose.
  const halves = editorHalves(sprout.content, lang);
  const source = halves.initialMarkdown.trim();

  // Which surface a rejected save came from — narrowed here rather than
  // trusted. Both halves require the ERROR as well as the name: `?form=` alone
  // is a bare URL anyone can type or a stale link someone kept, and honouring
  // it would open the Danger zone with nothing to explain why. An unknown
  // `?form=` claims neither surface, and its message falls through to the
  // page-level banner below.
  const heroForm: Surface | undefined =
    error && (form === "meta" || form === "state" || form === "date" || form === "type")
      ? form
      : undefined;
  const railForm = error && form === "delete" ? "delete" : undefined;

  const railItems: RailItem[] = [
    {
      id: "source",
      label: "Source",
      heading: "Source",
      icon: FileCode2,
      panel: source ? (
        // Read-only, zero JS. It is not a second rendering of the document — it
        // is the stored bytes, and the diagnostic for when the editor's
        // serializer and <Prose>'s parser disagree.
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-heading text-xs whitespace-pre-wrap">
          {source}
        </pre>
      ) : (
        <p className="text-sm text-muted-foreground">—</p>
      ),
    },
    {
      id: "media",
      label: "Media",
      heading: "Media",
      icon: Images,
      panel: <SproutMediaForm sprout={sprout} />,
    },
    {
      id: "delete",
      label: "Delete",
      heading: "Danger zone",
      icon: Trash2,
      // `railForm` already implies the error, exactly as `heroForm` does.
      panel: <SproutDeleteForm sprout={sprout} {...(railForm ? { error } : {})} />,
    },
  ];

  return (
    <>
      <LineageChrome lineage={lineage} as={Link} />
      {/* EntityRail wraps the WHOLE body: the panel is fixed and the page moves
          out from under it, so what moves has to be everything — a head that
          stayed put while the editor slid would read as a glitch rather than a
          push. The parenting chrome above floats, so it sits outside. */}
      <EntityRail label="Sprout panels" items={railItems} openOnError={railForm}>
        <article className="flex flex-col gap-8">
          <SproutHero
            slug={sprout.slug}
            name={resolveText(sprout.name)}
            description={resolveText(sprout.description).trim()}
            state={stateOf(sprout)}
            date={sprout.date}
            type={sprout.type}
            // Both or neither, and only when a head surface owns the message.
            // Every consumer inside the head also checks `errorForm`, so handing
            // it a delete's message would be inert — but it would still be the
            // page telling an island about a message that island must not render,
            // which is the opposite of the split this page just made.
            {...(heroForm ? { error, errorForm: heroForm } : {})}
            metaForm={<SproutMetaForm sprout={sprout} />}
            // Everything the head can write, as stored. STRICT textPart on both
            // halves of each pair, so an fr-only edit still moves the fingerprint
            // — resolveText would fall back and hide it.
            saved={JSON.stringify([
              textPart(sprout.name, "en"),
              textPart(sprout.name, "fr"),
              textPart(sprout.description, "en"),
              textPart(sprout.description, "fr"),
              sprout.date,
              sprout.type,
              stateOf(sprout),
            ])}
          />

          {/* Only an error no surface will show: the head reopens onto a rejected
              meta/state/date/type save and the rail onto a rejected delete, each
              rendering the message inside, so repeating it here would say it
              twice. */}
          {error && !heroForm && !railForm ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {/* No ContentCard: a card's header above an editor that is the page's
              only content is a frame around the page. The load goes through
              `editorHalves` — STRICT per half, so neither half is ever loaded
              into the other's editor. */}
          <ProseEditor
            key={lang}
            bare
            float
            {...halves}
            langSwitch={{
              current: lang,
              hrefs: editLangHrefs(`/admin/sprout/${encodeURIComponent(sprout.slug)}`, query),
            }}
            // No self-exclusion to do: entityOptions never emits `sprout:` rows
            // at all, because a sprout has no public URL to mint a reference to.
            // Passed anyway, so every content surface reads alike — the sentence
            // ContentCard's `selfRef` docblock carries for the call sites where
            // the argument does filter something.
            entities={entityOptions(raw, `sprout:${sprout.slug}`)}
            action={editContentAction}
            hidden={{ slug: sprout.slug, lang }}
          />
        </article>
      </EntityRail>
    </>
  );
}
