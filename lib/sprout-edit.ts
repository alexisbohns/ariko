import type { Text, SproutState } from "./data";
import { composeText, resolveText } from "./data";
import { DIGEST_TYPE } from "./synthesis";

// The editable subset of a Version. Structurally the $set payload for updateVersion.
export interface SproutPatch {
  name: Text;
  type: string;
  date: string;
  description: Text;
  state: SproutState;
}

// Pure. Maps the edit form → the editable subset. name and description compose from
// paired en/fr fields (B1). Trims strings; state falls back to "draft" on a
// missing/unrecognized value (only "private"/"published" override).
export function buildSproutPatch(form: FormData): SproutPatch {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const stateRaw = get("state");
  const state: SproutState =
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
// Mirrors validateSproutInput.
export function validateSproutPatch(
  p: SproutPatch,
): { ok: true } | { ok: false; error: string } {
  if (!resolveText(p.name)) return { ok: false, error: "sprout name is required" };
  if (!p.type) return { ok: false, error: "sprout type is required" };
  if (!p.date) return { ok: false, error: "sprout date is required" };
  return { ok: true };
}

// Pure gate for the publish→visibility cascade (final review C1). Digest
// publication (spec §3) marks review sign-off, not public exhibition: the
// digest beans/plants are curated private containers, and flipping them
// public is a separate human act on the bean/plant itself. Every other
// sprout type keeps cascading on publish (existing behavior).
export function shouldCascadePublish(type: string): boolean {
  return type !== DIGEST_TYPE;
}
