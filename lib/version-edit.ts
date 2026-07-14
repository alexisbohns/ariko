import type { VersionState } from "./data";

// The editable subset of a Version. Structurally the $set payload for updateVersion.
export interface VersionPatch {
  name: string;
  type: string;
  date: string;
  description: string;
  state: VersionState;
}

// Pure. Maps the edit form → the editable subset. Trims strings; state falls back to
// "draft" on a missing/unrecognized value (only "private"/"published" override).
export function buildVersionPatch(form: FormData): VersionPatch {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const stateRaw = get("state");
  const state: VersionState =
    stateRaw === "published" || stateRaw === "private" ? stateRaw : "draft";
  return {
    name: get("name"),
    type: get("type"),
    date: get("date"),
    description: get("description"),
    state,
  };
}

// Pure guard for the required editable fields (slug is immutable / from the route, so
// it is not validated here; description is optional). Mirrors validateVersionInput.
export function validateVersionPatch(
  p: VersionPatch,
): { ok: true } | { ok: false; error: string } {
  if (!p.name) return { ok: false, error: "version name is required" };
  if (!p.type) return { ok: false, error: "version type is required" };
  if (!p.date) return { ok: false, error: "version date is required" };
  return { ok: true };
}
