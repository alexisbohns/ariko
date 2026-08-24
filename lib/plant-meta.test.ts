import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPlantMetaPatch,
  BlankPlantNameError,
  InvalidPlantStatusError,
  plantMetaUpdate,
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

/**
 * Regression: the update document was first written as an object literal with
 * TWO `$set` keys — one for name/status, one added by a spread for the
 * description. The second silently replaced the first, so on any plant that
 * HAS a description (which is every real one), saving the Meta card wrote the
 * description and dropped the name and the status on the floor. It looked
 * exactly like "the status will not change", with no error anywhere.
 *
 * The shape is now built as one object, and this test pins it. `$set` and
 * `$unset` are legal together; two `$set`s in one literal are not, and TypeScript
 * does not catch a duplicate key produced by a spread.
 */
test("the update document sets all three fields in ONE $set", () => {
  const update = plantMetaUpdate({
    name: "Enerfip",
    description: "Crowdfunding for renewables",
    status: "inactive",
  });
  assert.deepEqual(update, {
    $set: {
      name: "Enerfip",
      description: "Crowdfunding for renewables",
      status: "inactive",
    },
  });
});

test("a cleared description becomes an $unset without costing the other two", () => {
  const update = plantMetaUpdate({ name: "Ariko", description: null, status: "active" });
  assert.deepEqual(update, {
    $set: { name: "Ariko", status: "active" },
    $unset: { description: "" },
  });
});
