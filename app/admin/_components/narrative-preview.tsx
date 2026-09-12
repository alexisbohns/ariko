import { PreviewSection } from "./preview-panel";

/**
 * The plant's own words, on the hub — as two clamped lines and a way in.
 *
 * The narrative used to BE the hub's middle: a prose editor between a header
 * and four tables, on a page whose other five-sixths are a directory. It has a
 * page of its own now, and what stays here is the first sentence or two of it,
 * read-only, in the same shell the four set previews wear
 * (`PreviewSection`) — so the plant's writing reads as one more thing the
 * plant contains rather than as an appliance parked in the middle of a list.
 *
 * This component DERIVES NOTHING. The excerpt is computed by the page with
 * `narrativeExcerpt` over the same STRICT `textPart(plant.content, "en")` the
 * editor loads, and arrives as a string; the href is built by the page from
 * `narrativeHref`. That is the same posture `ExhibitionPanel` takes on the
 * rail, and it is what keeps a second idea of "which half of a bilingual
 * field" out of this file.
 *
 * The clamp is a display cap over a cut that already happened: `narrativeExcerpt`
 * bounds the STRING (so a 40,000-word narrative never reaches the browser) and
 * `line-clamp-2` bounds the BOX (so a 200-character excerpt that wraps to three
 * lines at a narrow width still occupies two). Neither is redundant — one is
 * about bytes, the other about height.
 */
export function NarrativePreview({ excerpt, href }: { excerpt: string; href: string }) {
  return (
    <PreviewSection
      title="Narrative"
      link={{ href, label: excerpt ? "edit →" : "write one →" }}
      empty={excerpt ? undefined : "nothing written yet"}
    >
      <p className="line-clamp-2 text-sm text-muted-foreground">{excerpt}</p>
    </PreviewSection>
  );
}
