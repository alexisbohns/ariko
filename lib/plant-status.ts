import type { Plant, PlantStatus } from "./data";

// The vocabulary, in render order. Exported as the single source for the enum's
// members — the admin select, the validator script and the guard below all read
// it, exactly as PLANT_ROLE_KINDS is read.
export const PLANT_STATUSES: readonly PlantStatus[] = ["active", "inactive"];

// ONE display form per member. "Inactive" is the only word this feature uses —
// not "Previously", not "Past", not "Archived". A vocabulary with three display
// forms for one stored value is three chances to drift, and the drift is silent
// because each surface reads correctly on its own.
const LABELS: Record<PlantStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

/**
 * The one place absence becomes a value. Every read surface goes through it, so
 * `status ?? "active"` is written once rather than in each page that groups,
 * badges or tabulates.
 */
export function statusOf(plant: Pick<Plant, "status">): PlantStatus {
  return plant.status ?? "active";
}

export function statusLabel(status: PlantStatus): string {
  return LABELS[status];
}

/**
 * The other member. Written when the plant page replaced the status select
 * with a one-click zap: the toggle posts the RESULT of this rather than a bare
 * "flip it", so the action still validates a named member and a stale page
 * cannot flip a status somebody already changed in another tab into a third
 * thing.
 */
export function nextStatus(status: PlantStatus): PlantStatus {
  return status === "active" ? "inactive" : "active";
}

export function isPlantStatus(raw: string): raw is PlantStatus {
  return (PLANT_STATUSES as readonly string[]).includes(raw);
}

/**
 * Pure. The landing gallery's split (spec §6).
 *
 * Order is preserved WITHIN each group rather than re-sorted: the dataset's
 * order is the authored one, and this function's job is to separate, not to
 * rank. `inactive` comes back empty for an all-active garden, which is what
 * lets the page decide not to render the divider at all.
 */
export function splitPlantsByStatus(plants: Plant[]): { active: Plant[]; inactive: Plant[] } {
  const active: Plant[] = [];
  const inactive: Plant[] = [];
  for (const plant of plants) (statusOf(plant) === "inactive" ? inactive : active).push(plant);
  return { active, inactive };
}
