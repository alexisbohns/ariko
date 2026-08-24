import { composeText, textPart, type PlantRole, type PlantRoleKind } from "./data";

// The vocabulary, in render order. Exported as the single source for the enum's
// members: the admin select, the validator script and the guard below all read
// it, so adding a fifth kind is one edit rather than four.
export const PLANT_ROLE_KINDS: readonly PlantRoleKind[] = [
  "owner",
  "co-owner",
  "lead",
  "contributor",
];

// Display forms of the enum. Deliberately NOT derived from the slug by
// capitalizing it — "co-owner" would come out "Co-owner" by luck and any future
// multi-word kind by accident.
const LABELS: Record<PlantRoleKind, string> = {
  owner: "Owner",
  "co-owner": "Co-owner",
  lead: "Lead",
  contributor: "Contributor",
};

export interface RoleParts {
  label: string; // the enum's display form — always present
  title: string | null; // the custom local title, or null when absent/blank
}

/**
 * The one place the vocabulary becomes words, so the plant page, the landing
 * gallery and the admin garden cannot drift apart.
 *
 * Returns the two halves rather than a composed string: each surface renders
 * them differently (a Badge, a muted subtitle, a table cell), and typography is
 * not this module's business. Callers that want the one-line form join them
 * with " · ".
 */
export function roleParts(role: PlantRole, lang: "en" | "fr" = "en"): RoleParts {
  // Falls back across languages the way every other read surface does: a
  // fr-only title is a valid title (B1), and showing it beats showing nothing.
  const title = (textPart(role.title, lang) || textPart(role.title, lang === "en" ? "fr" : "en"))
    .trim();
  return { label: LABELS[role.kind], title: title || null };
}

/** The one-line form: `Lead · Head of Product`, or just `Owner`. */
export function roleLine(role: PlantRole, lang: "en" | "fr" = "en"): string {
  const { label, title } = roleParts(role, lang);
  return title ? `${label} · ${title}` : label;
}

export class InvalidRoleKindError extends Error {
  constructor(public received: string) {
    super(`unknown role: ${received || "(blank)"}`);
    this.name = "InvalidRoleKindError";
  }
}

export function isPlantRoleKind(raw: string): raw is PlantRoleKind {
  return (PLANT_ROLE_KINDS as readonly string[]).includes(raw);
}

/**
 * Pure. Maps the role card's form → the stored role.
 *
 * An unrecognized `kind` throws rather than falling back, which is the opposite
 * of buildSproutPatch's `state` handling. That fallback is safe because it
 * HIDES things; a wrong role is a public claim about Alexis's relationship to
 * someone else's project, so it fails loudly instead. The action turns the
 * throw into a ?error redirect.
 */
export function buildPlantRolePatch(form: FormData): PlantRole {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const kind = get("kind");
  if (!isPlantRoleKind(kind)) throw new InvalidRoleKindError(kind);

  const title = composeText(get("title"), get("titleFr"));
  const detail = composeText(get("detail"), get("detailFr"));

  // composeText returns "" when both parts are blank. An empty string is
  // OMITTED rather than stored — same rule createBean applies to description,
  // because a stored "" renders as a dangling line.
  return {
    kind,
    ...(title === "" ? {} : { title }),
    ...(detail === "" ? {} : { detail }),
  };
}
