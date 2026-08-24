import { PLANT_PREFIX, POD_PREFIX, type Bee, type Plant, type PlantNature, type PlantRole, type Pod, type RawGarden } from "./data";

// The slice-1 PR2 re-tiering (spec §4) as a pure, idempotent transform over a
// RawGarden. scripts/migrate-retier.ts applies the SAME transform to
// data/garden.yml and to Mongo; lib/retier.test.ts asserts it against the real
// garden file. Docs read from YAML/Mongo may still carry the retired `domain`
// key, which the transform strips.

/**
 * Every plant this historical transform creates gets the same role.
 *
 * `Plant.role` is required, and this transform predates the concept — it has no
 * opinion about which of them Alexis owns versus leads. It writes the same
 * default the backfill script writes, for the same reason: the real roles are
 * authored afterwards, by hand, through the admin role card. Re-running this
 * migration cannot overwrite one, because it only ever creates plants that do
 * not already exist.
 */
const DEFAULT_ROLE: PlantRole = { kind: "owner" };

// Pods of the practice promoted in place: the pod doc is absorbed into a plant
// (name/description/visibility/tags carried over), and its beans climb to
// plant: refs. natures per spec §4 — all plain works.
export const PROMOTED: { slug: string; natures: PlantNature[] }[] = [
  { slug: "pbbls", natures: ["work"] },
  { slug: "femfolk", natures: ["work"] },
  { slug: "teale", natures: ["work"] },
  { slug: "casa", natures: ["work"] },
  { slug: "pebblestones", natures: ["work"] },
  { slug: "enerfip", natures: ["work"] },
];

// Plants authored fresh. If a pod with the same slug exists (e.g. created via
// triage before this migration ran), it is absorbed instead of duplicated —
// the catalog's fields win, the pod's visibility/tags carry over.
export const CREATED: Plant[] = [
  {
    slug: "bohns-music",
    name: "Bohns Music",
    natures: ["work"],
    role: DEFAULT_ROLE,
    description: "The music practice — albums and songs published as Bohns Music.",
  },
  {
    slug: "melogram",
    name: "Melogram",
    natures: ["work", "tool"],
    role: DEFAULT_ROLE,
    description: "Music release hub — the Arkaik of music; distributes Bohns Music.",
    relations: [{ kind: "distributes", ref: "plant:bohns-music" }],
  },
  {
    slug: "arkaik",
    name: "Arkaik",
    natures: ["tool"],
    role: DEFAULT_ROLE,
    description: "Journal of record for the code practice; chronicles Pebbles and Femfolk.",
    relations: [
      { kind: "chronicles", ref: "plant:pbbls" },
      { kind: "chronicles", ref: "plant:femfolk" },
    ],
  },
  {
    slug: "ariko",
    name: "Ariko",
    natures: ["work", "tool"],
    role: DEFAULT_ROLE,
    description: "The central node — portfolio, practice graph and federation hub.",
  },
  {
    slug: "paulopus",
    name: "Paulopus",
    natures: ["work"],
    role: DEFAULT_ROLE,
    description: "World Cup 2026 oracle — predictions, briefs and the writer routine.",
  },
  {
    slug: "oxymore",
    name: "Oxymore",
    natures: ["tool"],
    role: DEFAULT_ROLE,
    description: "Third-party panel stack. Read-only in practice — no automation ever targets it.",
  },
];

export const ALBUM_PODS = ["wait-for-the-sun", "celesta", "republic-of-masquerade"];

// First bees of the federation (spec §4): the map shows the future before it
// runs. The two LIVE bees are seeded public (the explicit D1-exhibition
// opt-in); planned bees stay default-private until they exist.
export const SEED_BEES: Bee[] = [
  {
    slug: "lab-note-pipeline",
    name: "Lab Note pipeline",
    kind: "workflow",
    status: "live",
    engine: "action",
    levers: [],
    serves: ["plant:ariko", "plant:pbbls", "plant:femfolk", "plant:arkaik", "plant:melogram"],
    description: "Posts Lab Notes from sibling repos' merged PRs into the Ariko inbox.",
    visibility: "public",
  },
  {
    slug: "song-identifier",
    name: "Song identifier",
    kind: "capability",
    status: "live",
    levers: [],
    serves: ["plant:femfolk"],
    description: "Identifies songs for Femfolk research.",
    visibility: "public",
  },
  {
    slug: "arkaik-adapter",
    name: "Arkaik adapter",
    kind: "adapter",
    status: "planned",
    levers: [],
    serves: ["plant:arkaik"],
    description: "Will ingest the Arkaik journal feed into the Ariko read model (slice 3).",
  },
  {
    slug: "melogram-feed",
    name: "Melogram feed",
    kind: "adapter",
    status: "planned",
    levers: [],
    serves: ["plant:melogram"],
    description: "Will carry Melogram release events into the Ariko beanstalk.",
  },
  {
    slug: "femfolk-researcher",
    name: "Femfolk researcher",
    kind: "routine",
    status: "planned",
    engine: "claude-routine",
    levers: [],
    serves: ["plant:femfolk"],
    description: "Will research artists and prepare Femfolk episode material.",
  },
  {
    slug: "weekly-digest",
    name: "Weekly digest",
    kind: "routine",
    status: "planned",
    engine: "claude-routine",
    levers: [],
    serves: ["plant:ariko"],
    description: "Will write the weekly cross-plant digest of the beanstalk (slice 5).",
  },
];

const stripDomain = (pod: Pod): Pod => {
  const rest = { ...pod } as Pod & { domain?: unknown };
  delete rest.domain;
  return rest;
};

export function retierGarden(raw: RawGarden): RawGarden {
  const inPods = raw.pods ?? [];
  const plants = [...(raw.plants ?? [])];
  const bees = [...(raw.bees ?? [])];
  const plantSlugs = new Set(plants.map((p) => p.slug));
  const podBySlug = new Map(inPods.map((p) => [p.slug, p]));

  // Every catalog slug absorbs a same-slug pod when one exists.
  const absorbed = new Set<string>();

  for (const { slug, natures } of PROMOTED) {
    const pod = podBySlug.get(slug);
    if (pod) absorbed.add(slug);
    if (plantSlugs.has(slug) || !pod) continue; // already promoted, or nothing to promote
    // parents dropped deliberately: plants are roots; containment is re-expressed by the beans climbing.
    const { parents: _parents, ...rest } = stripDomain(pod);
    plants.push({ ...rest, natures: [...natures], role: { ...DEFAULT_ROLE } });
    plantSlugs.add(slug);
  }

  for (const def of CREATED) {
    const pod = podBySlug.get(def.slug);
    if (pod) absorbed.add(def.slug);
    if (plantSlugs.has(def.slug)) continue;
    const plant = structuredClone(def); // never alias the catalog into the output
    plants.push({
      ...plant,
      ...(pod?.visibility ? { visibility: pod.visibility } : {}),
      ...(pod?.tags ? { tags: pod.tags } : {}),
    });
    plantSlugs.add(def.slug);
  }

  const pods = inPods
    .filter((p) => !absorbed.has(p.slug))
    .map((p) => {
      const out = stripDomain(p);
      const parents = [...(out.parents ?? [])];
      if (ALBUM_PODS.includes(out.slug) && !parents.includes("plant:bohns-music")) {
        parents.push("plant:bohns-music");
      }
      return parents.length > 0 ? { ...out, parents } : out;
    });

  // A pod: ref whose slug is now a plant (and no pod with that slug remains)
  // climbs a tier. Catalog-scoped so an unrelated future pod named like a
  // plant is never rewritten by accident.
  const catalog = new Set([...PROMOTED.map((d) => d.slug), ...CREATED.map((d) => d.slug)]);
  const remainingPodSlugs = new Set(pods.map((p) => p.slug));
  const promoteRef = (ref: string): string => {
    if (!ref.startsWith(POD_PREFIX)) return ref;
    const slug = ref.slice(POD_PREFIX.length);
    return catalog.has(slug) && !remainingPodSlugs.has(slug) ? PLANT_PREFIX + slug : ref;
  };

  const beans = (raw.beans ?? []).map((b) => {
    const parents = (b.parents ?? []).map(promoteRef);
    return JSON.stringify(parents) === JSON.stringify(b.parents ?? []) ? b : { ...b, parents };
  });

  const sprouts = (raw.sprouts ?? []).map((s) => {
    const parents = (s.parents ?? []).map(promoteRef);
    const parentsChanged = JSON.stringify(parents) !== JSON.stringify(s.parents ?? []);
    const relations = s.relations?.map((r) => ({ ...r, ref: promoteRef(r.ref) }));
    const relationsChanged = s.relations != null && JSON.stringify(relations) !== JSON.stringify(s.relations);
    if (!parentsChanged && !relationsChanged) return s;
    return {
      ...s,
      ...(parentsChanged ? { parents } : {}),
      ...(relationsChanged ? { relations } : {}),
    };
  });

  const beeSlugs = new Set(bees.map((b) => b.slug));
  for (const bee of SEED_BEES) {
    if (!beeSlugs.has(bee.slug)) bees.push(structuredClone(bee)); // never alias the catalog into the output
  }

  // Spread raw first so unknown top-level keys pass through untouched.
  return { ...raw, plants, pods, beans, sprouts, bees };
}
