import test from "node:test";
import assert from "node:assert/strict";
import type { Plant, PlantStatus } from "./data";
import {
  PLANT_STATUSES,
  isPlantStatus,
  statusLabel,
  statusOf,
  splitPlantsByStatus,
} from "./plant-status";

const plant = (slug: string, status?: PlantStatus): Plant => ({
  slug,
  name: slug,
  natures: ["work"],
  role: { kind: "owner" },
  description: "",
  ...(status ? { status } : {}),
});

test("the vocabulary is exactly two members, active first", () => {
  assert.deepEqual([...PLANT_STATUSES], ["active", "inactive"]);
});

test("statusOf reads absence as active", () => {
  assert.equal(statusOf(plant("ariko")), "active");
  assert.equal(statusOf(plant("enerfip", "inactive")), "inactive");
  assert.equal(statusOf(plant("femfolk", "active")), "active");
});

test("statusLabel is the one display form — Inactive, never Previously or Past", () => {
  assert.equal(statusLabel("active"), "Active");
  assert.equal(statusLabel("inactive"), "Inactive");
});

test("isPlantStatus guards the enum", () => {
  assert.equal(isPlantStatus("inactive"), true);
  assert.equal(isPlantStatus("archived"), false);
  assert.equal(isPlantStatus(""), false);
});

test("splitPlantsByStatus preserves dataset order within each group", () => {
  const plants = [
    plant("ariko"),
    plant("enerfip", "inactive"),
    plant("femfolk"),
    plant("paulopus", "inactive"),
  ];
  const { active, inactive } = splitPlantsByStatus(plants);
  assert.deepEqual(
    active.map((p) => p.slug),
    ["ariko", "femfolk"],
  );
  assert.deepEqual(
    inactive.map((p) => p.slug),
    ["enerfip", "paulopus"],
  );
});

test("an all-active garden yields an empty inactive group, so no divider renders", () => {
  const { active, inactive } = splitPlantsByStatus([plant("ariko"), plant("femfolk", "active")]);
  assert.equal(active.length, 2);
  assert.deepEqual(inactive, []);
});
