import type { Text, VersionState } from "./data";
import { composeText, resolveText } from "./data";

// The editable subset of a Version. Structurally the $set payload for updateVersion.
export interface VersionPatch {
  name: Text;
  type: string;
  date: string;
  description: Text;
  state: VersionState;
}

// Pure. Maps the edit form → the editable subset. name and description compose from
// paired en/fr fields (B1). Trims strings; state falls back to "draft" on a
// missing/unrecognized value (only "private"/"published" override).
export function buildVersionPatch(form: FormData): VersionPatch {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const stateRaw = get("state");
  const state: VersionState =
    stateRaw === "published" || stateRaw === "private" ? stateRaw : "draft";
  return {
    name: composeText(get("name"), get("nameFr")),
    type: get("type"),
    date: get("date"),
    description: composeText(get("description"), get("descriptionFr")),
    state,
  };
}

// Pure guard for the required editable fields (slug is immutable / from the route, so
// it is not validated here; description is optional). "name required" means at least
// one language is present (resolveText non-empty) — an fr-only name is valid.
// Mirrors validateVersionInput.
export function validateVersionPatch(
  p: VersionPatch,
): { ok: true } | { ok: false; error: string } {
  if (!resolveText(p.name)) return { ok: false, error: "version name is required" };
  if (!p.type) return { ok: false, error: "version type is required" };
  if (!p.date) return { ok: false, error: "version date is required" };
  return { ok: true };
}
