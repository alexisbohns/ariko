import type { Capture, Media, Source, Text, VersionState } from "./data";
import { composeText, resolveText } from "./data";

export type ParentResolution =
  | { mode: "create"; slug: string }
  | { mode: "existing"; slug: string }
  | { mode: "none" };

// New wins: a non-blank new slug means "create a new parent". Else a non-blank
// selected slug means "use existing". Else none. (Both fields are always rendered
// because there is no client JS to toggle them.)
export function resolveParentChoice(newSlug: string, selectedSlug: string): ParentResolution {
  const created = newSlug.trim();
  if (created) return { mode: "create", slug: created };
  const selected = selectedSlug.trim();
  if (selected) return { mode: "existing", slug: selected };
  return { mode: "none" };
}

// The fields written to a new Version. Structurally the createVersion input.
export interface VersionInput {
  slug: string;
  name: Text;
  type: string;
  date: string;
  description: Text;
  state: VersionState;
  parents: string[];
  media: Media[];
  source: Source;
}

// Pure. Maps the triage form + the source capture into a VersionInput. name and
// description compose from paired en/fr fields (B1), WYSIWYG: the triage page
// prefills the boxes per-language (name from capture.title, descriptions from
// capture.body via textPart), and what the boxes submit is exactly what is
// stored — clearing a box clears that language, and a fully cleared name fails
// validation instead of being silently resurrected. Carries the capture's media
// and provenance. `atomParentSlug` (resolved by the action) wires the atom
// parent ref.
export function buildVersionInput(
  form: FormData,
  capture: Capture,
  atomParentSlug: string | null,
): VersionInput {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const stateRaw = get("state");
  const state: VersionState =
    stateRaw === "published" || stateRaw === "private" ? stateRaw : "draft";

  return {
    slug: get("versionSlug"),
    name: composeText(get("versionName"), get("versionNameFr")),
    type: get("type"),
    date: get("date"),
    description: composeText(get("description"), get("descriptionFr")),
    state,
    parents: atomParentSlug ? [`atom:${atomParentSlug}`] : [],
    media: capture.media,
    source: capture.source,
  };
}

// Pure guard for the required Version fields (spec §7). "name required" means at
// least one language is present (resolveText non-empty) — an fr-only name is valid.
// Media/source are carried, not user-entered, so they are not validated here.
export function validateVersionInput(
  v: VersionInput,
): { ok: true } | { ok: false; error: string } {
  if (!v.slug) return { ok: false, error: "version slug is required" };
  if (!resolveText(v.name)) return { ok: false, error: "version name is required" };
  if (!v.type) return { ok: false, error: "version type is required" };
  if (!v.date) return { ok: false, error: "version date is required" };
  return { ok: true };
}
