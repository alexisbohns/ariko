import type { Capture, Media, Source, VersionState } from "./data";
import { resolveText } from "./data";

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
  name: string;
  type: string;
  date: string;
  description: string;
  state: VersionState;
  parents: string[];
  media: Media[];
  source: Source;
}

// Pure. Maps the triage form + the source capture into a VersionInput. Prefills
// name from the capture title and description from the capture note (flattened via
// resolveText), both overridable by form fields. Carries the capture's media and
// provenance. `atomParentSlug` (resolved by the action) wires the atom parent ref.
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
    name: get("versionName") || capture.title.trim(),
    type: get("type"),
    date: get("date"),
    description: get("description") || resolveText(capture.body),
    state,
    parents: atomParentSlug ? [`atom:${atomParentSlug}`] : [],
    media: capture.media,
    source: capture.source,
  };
}

// Pure guard for the required Version fields (spec §7). Media/source are carried,
// not user-entered, so they are not validated here.
export function validateVersionInput(
  v: VersionInput,
): { ok: true } | { ok: false; error: string } {
  if (!v.slug) return { ok: false, error: "version slug is required" };
  if (!v.name) return { ok: false, error: "version name is required" };
  if (!v.type) return { ok: false, error: "version type is required" };
  if (!v.date) return { ok: false, error: "version date is required" };
  return { ok: true };
}
