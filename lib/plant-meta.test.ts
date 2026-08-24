import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPlantMetaPatch,
  BlankPlantNameError,
  InvalidPlantStatusError,
} from "./plant-meta";

const form = (fields: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

test("composes both bilingual pairs and carries the status", () => {
  const patch = buildPlantMetaPatch(
    form({
      name: "Enerfip",
      nameFr: "Enerfip",
      description: "Crowdfunding for renewables",
      descriptionFr: "Financement participatif des renouvelables",
      status: "inactive",
    }),
  );
  assert.deepEqual(patch, {
    name: { en: "Enerfip", fr: "Enerfip" },
    description: {
      en: "Crowdfunding for renewables",
      fr: "Financement participatif des renouvelables",
    },
    status: "inactive",
  });
});

test("an fr-only name is valid — the same B1 rule the role title follows", () => {
  const patch = buildPlantMetaPatch(form({ name: "  ", nameFr: "Melogramme", status: "active" }));
  assert.deepEqual(patch.name, { fr: "Melogramme" });
});

test("a name blank in BOTH languages throws rather than saving", () => {
  assert.throws(
    () => buildPlantMetaPatch(form({ name: "   ", nameFr: "", status: "active" })),
    BlankPlantNameError,
  );
});

test("a blank description is reported as an explicit clear, never as an empty string", () => {
  const patch = buildPlantMetaPatch(
    form({ name: "Ariko", description: "  ", descriptionFr: "", status: "active" }),
  );
  // null, not "" and not absent: a plant that HAS a description and whose form
  // comes back blank must lose it, so the writer has something to $unset on.
  assert.equal(patch.description, null);
});

test("an unknown status throws rather than falling back to active", () => {
  assert.throws(
    () => buildPlantMetaPatch(form({ name: "Ariko", status: "archived" })),
    InvalidPlantStatusError,
  );
});

test("a missing status field reads as active", () => {
  assert.equal(buildPlantMetaPatch(form({ name: "Ariko" })).status, "active");
});
