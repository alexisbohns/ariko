import test from "node:test";
import assert from "node:assert/strict";
import {
  roleParts,
  roleLine,
  buildPlantRolePatch,
  isPlantRoleKind,
  InvalidRoleKindError,
  PLANT_ROLE_KINDS,
} from "./plant-role";

const form = (fields: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

test("roleParts gives every kind a display label", () => {
  assert.deepEqual(
    PLANT_ROLE_KINDS.map((kind) => roleParts({ kind }).label),
    ["Owner", "Co-owner", "Lead", "Contributor"],
  );
});

test("roleParts returns the custom title when there is one, null when there is not", () => {
  assert.equal(roleParts({ kind: "lead", title: "Head of Product" }).title, "Head of Product");
  assert.equal(roleParts({ kind: "owner" }).title, null);
  // A stored blank should never have happened (buildPlantRolePatch omits it),
  // but a hand-written doc could carry one — it must not render as a dangling "·".
  assert.equal(roleParts({ kind: "owner", title: "   " }).title, null);
});

test("roleParts falls back across languages, like every other read surface", () => {
  const role = { kind: "lead" as const, title: { fr: "Responsable produit" } };
  assert.equal(roleParts(role, "en").title, "Responsable produit");
  assert.equal(roleParts({ kind: "lead", title: { en: "Lead", fr: "Chef" } }, "fr").title, "Chef");
});

test("roleLine composes the enum and the title, and stands alone without one", () => {
  assert.equal(roleLine({ kind: "lead", title: "Head of Product" }), "Lead · Head of Product");
  assert.equal(roleLine({ kind: "owner" }), "Owner");
  assert.equal(roleLine({ kind: "co-owner" }), "Co-owner");
});

test("buildPlantRolePatch composes en/fr for both pairs", () => {
  const role = buildPlantRolePatch(
    form({
      kind: "lead",
      title: "Head of Product",
      titleFr: "Responsable produit",
      detail: "Leading product & design.",
      detailFr: "Pilote le produit et le design.",
    }),
  );
  assert.deepEqual(role, {
    kind: "lead",
    title: { en: "Head of Product", fr: "Responsable produit" },
    detail: { en: "Leading product & design.", fr: "Pilote le produit et le design." },
  });
});

test("buildPlantRolePatch OMITS blank title and detail rather than storing empty strings", () => {
  const role = buildPlantRolePatch(form({ kind: "owner", title: "  ", detailFr: "" }));
  assert.deepEqual(role, { kind: "owner" });
  assert.equal("title" in role, false);
  assert.equal("detail" in role, false);
});

test("buildPlantRolePatch keeps an fr-only title (B1: either language is enough)", () => {
  const role = buildPlantRolePatch(form({ kind: "contributor", titleFr: "Contributrice" }));
  assert.deepEqual(role, { kind: "contributor", title: { fr: "Contributrice" } });
});

test("buildPlantRolePatch REJECTS an unknown kind instead of defaulting", () => {
  // Deliberately unlike buildSproutPatch's `state`, which falls back to "draft".
  // That fallback hides things; this one would publish a false claim.
  assert.throws(() => buildPlantRolePatch(form({ kind: "founder" })), InvalidRoleKindError);
  assert.throws(() => buildPlantRolePatch(form({ kind: "" })), InvalidRoleKindError);
  assert.throws(() => buildPlantRolePatch(new FormData()), InvalidRoleKindError);
});

test("isPlantRoleKind accepts exactly the vocabulary", () => {
  for (const kind of PLANT_ROLE_KINDS) assert.equal(isPlantRoleKind(kind), true);
  assert.equal(isPlantRoleKind("founder"), false);
  assert.equal(isPlantRoleKind("Owner"), false);
});
