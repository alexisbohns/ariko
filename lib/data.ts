import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

export type Domain = "music" | "design" | "podcast";

export type Visibility = "private" | "public";
export type SproutState = "draft" | "private" | "published";

export interface LocalizedText {
  en?: string;
  fr?: string;
}
export type Text = string | LocalizedText;

export interface MediaEmbed {
  kind: "embed";
  provider: string; // soundcloud | spotify | deezer | ausha | youtube | vimeo | figma | ...
  url: string;
  embedId?: string;
}
export interface MediaImage {
  kind: "image";
  storageKey: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}
export type Media = MediaEmbed | MediaImage;

export interface Source {
  kind: string; // manual | github | changelog | arkaik | ...
  url?: string;
  externalId?: string;
  capturedAt?: string;
}

// Non-containment edge (G2): the sprout that declares it points —kind→ ref.
// ref reuses the prefixed grammar (sprout:/bean:/pod:); kind is a free
// string ("evolves-from", "featured-in", …) — vocabulary curation is a later
// concern. No referential integrity by design: the filterPublic scrub and the
// graph serializer's both-ends prune hide edges whose target is gone or hidden.
export interface Relation {
  kind: string;
  ref: string;
}

export type PlantNature = "work" | "tool";

// Top tier of the practice graph (slice 1 PR2). Plants are roots — they carry
// no parents[]; pods and beans parent INTO them. relations[] carries the
// articulation vocabulary (distributes | chronicles | uses | publishes-to |
// monitors) as free strings, same G2 rule as sprout relations.
export interface Plant {
  slug: string;
  name: Text;
  natures: PlantNature[]; // array: melogram is both work AND tool
  description: Text;
  visibility?: Visibility; // default treated as "public", same rule as pods
  relations?: Relation[];
  tags?: string[];
}

// Operational species (slice 1 PR2): integration bricks, NOT content. Outside
// the publish cascades entirely, and default-PRIVATE (the opposite of every
// content tier) — public exhibition is an explicit per-bee opt-in.
export interface BeeLever {
  label: string;
  url?: string;
  ref?: string; // workflow file path, routine id, …
}
export interface Bee {
  slug: string;
  name: Text;
  kind: "adapter" | "routine" | "workflow" | "capability";
  status: "planned" | "live" | "paused" | "broken";
  engine?: string; // claude-routine | gemini-action | action | …
  schedule?: string; // human-readable or cron
  levers: BeeLever[];
  serves: string[]; // ["plant:femfolk", …]
  description: Text;
  visibility?: Visibility; // default treated as "private"
}

export interface Pod {
  slug: string;
  name: Text; // bilingual since B1; plain strings remain valid (no migration)
  domain?: Domain; // TEMPORARY optional during PR2 — deleted in the Domain-retirement task
  parents?: string[]; // containment ONLY, e.g. ["plant:bohns-music"] (PR2)
  description: Text;
  visibility?: Visibility; // default treated as "public"
  tags?: string[];
}

export interface Bean {
  slug: string;
  name: Text; // bilingual since B1; plain strings remain valid (no migration)
  parents: string[]; // containment ONLY: "pod:…" and/or "plant:…" refs — a bean may skip the pod tier
  visibility?: Visibility; // default treated as "public"
  tags?: string[];
}

export interface Sprout {
  slug: string;
  name: Text; // bilingual since B1; plain strings remain valid (no migration)
  type: string;
  date: string;
  description: Text;
  parents: string[]; // containment ONLY, e.g. ["bean:rom-win"] — drives the privacy cascades and timeline grouping; cross-links go in relations[]
  relations?: Relation[]; // non-containment edges (G2); scrubbed by filterPublic
  state?: SproutState; // absent => NOT published (safe default)
  content?: Text; // optional rich markdown, localizable
  media?: Media[];
  source?: Source;
  tags?: string[];
  [key: string]: unknown; // flexible per-type properties
}

export interface RawGarden {
  plants?: Plant[];
  pods?: Pod[];
  beans?: Bean[];
  sprouts?: Sprout[];
  bees?: Bee[];
}

export type SeedStatus = "inbox" | "promoted" | "discarded";

export interface SeedSuggestion {
  podSlug?: string;
  beanSlug?: string;
  type?: string;
  tags?: string[];
}

// Raw inbox item. Kept separate from the botanical model until triaged (spec §4.2).
export interface Seed {
  id: string; // crypto.randomUUID() at creation; seeds are not slug-addressable
  title: Text; // bilingual since C1; plain strings remain valid (no migration)
  body?: LocalizedText;
  content?: LocalizedText;
  media: Media[];
  source: Source;
  suggested?: SeedSuggestion;
  status: SeedStatus;
  promotedTo: string[]; // sprout slugs; empty until 2b triage
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface TimelineEntry {
  sprout: Sprout;
  bean: Bean | null;
  plant: Plant | null;
  domain: Domain | null; // TEMPORARY — deleted in the Domain-retirement task
}

export interface Dataset {
  getPlants(): Plant[];
  podsForPlant(slug: string): Pod[];
  beansForPlant(slug: string): Bean[]; // beans parented DIRECTLY to the plant
  unrootedPods(): Pod[]; // pods with no resolvable plant parent
  plantForBean(slug: string): Plant | null;
  getPods(): Pod[];
  beansForPod(slug: string): Bean[];
  standaloneBeans(): Bean[]; // no resolvable pod NOR plant parent
  getBean(slug: string): Bean | undefined;
  sproutsForBean(slug: string): Sprout[];
  timelineSprouts(): TimelineEntry[];
  domainForBean(slug: string): Domain | null; // TEMPORARY — deleted in the Domain-retirement task
}

// The prefixed-ref grammar, shared with the graph serializer (lib/graph.ts).
// parents[] uses plant:/pod:/bean: only; sprout: and bee: appear in
// relations[] refs (and as graph node ids) — nothing is ever contained BY a
// sprout or a bee.
export const PLANT_PREFIX = "plant:";
export const POD_PREFIX = "pod:";
export const BEAN_PREFIX = "bean:";
export const SPROUT_PREFIX = "sprout:";
export const BEE_PREFIX = "bee:";

export function parentsWithPrefix(parents: string[] | undefined, prefix: string): string[] {
  return (parents ?? []).filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length));
}

// Newest first; ties keep input order (stable sort).
function byDateDesc(a: { date: string }, b: { date: string }): number {
  return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
}

export function buildDataset(raw: RawGarden): Dataset {
  const pods = raw.pods ?? [];
  const beans = raw.beans ?? [];
  const sprouts = raw.sprouts ?? [];

  const podBySlug = new Map(pods.map((p) => [p.slug, p]));
  const beanBySlug = new Map(beans.map((b) => [b.slug, b]));

  const plants = raw.plants ?? [];
  const plantBySlug = new Map(plants.map((p) => [p.slug, p]));

  // plant slug -> pods (in garden order); only resolvable plant refs.
  const podsByPlant = new Map<string, Pod[]>();
  const unrooted: Pod[] = [];
  for (const pod of pods) {
    const plantSlugs = parentsWithPrefix(pod.parents, PLANT_PREFIX).filter((s) => plantBySlug.has(s));
    if (plantSlugs.length === 0) {
      unrooted.push(pod);
      continue;
    }
    for (const p of plantSlugs) {
      const list = podsByPlant.get(p) ?? [];
      list.push(pod);
      podsByPlant.set(p, list);
    }
  }

  // pod/plant slug -> beans (in garden order); only resolvable refs. A bean is
  // standalone only when NEITHER tier resolves (a direct plant parent counts).
  const beansByPod = new Map<string, Bean[]>();
  const beansByPlant = new Map<string, Bean[]>();
  const standalone: Bean[] = [];
  for (const bean of beans) {
    const podSlugs = parentsWithPrefix(bean.parents, POD_PREFIX).filter((s) => podBySlug.has(s));
    const plantSlugs = parentsWithPrefix(bean.parents, PLANT_PREFIX).filter((s) => plantBySlug.has(s));
    if (podSlugs.length === 0 && plantSlugs.length === 0) {
      standalone.push(bean); // no parent, or only dangling refs
      continue;
    }
    for (const p of podSlugs) {
      const list = beansByPod.get(p) ?? [];
      list.push(bean);
      beansByPod.set(p, list);
    }
    for (const p of plantSlugs) {
      const list = beansByPlant.get(p) ?? [];
      list.push(bean);
      beansByPlant.set(p, list);
    }
  }

  // bean slug -> sprouts, sorted newest first.
  const sproutsByBean = new Map<string, Sprout[]>();
  for (const sprout of sprouts) {
    for (const beanSlug of parentsWithPrefix(sprout.parents, BEAN_PREFIX)) {
      const list = sproutsByBean.get(beanSlug) ?? [];
      list.push(sprout);
      sproutsByBean.set(beanSlug, list);
    }
  }
  for (const list of sproutsByBean.values()) {
    list.sort(byDateDesc);
  }

  function domainForBean(slug: string): Domain | null {
    const bean = beanBySlug.get(slug);
    if (!bean) return null;
    for (const podSlug of parentsWithPrefix(bean.parents, POD_PREFIX)) {
      const pod = podBySlug.get(podSlug);
      if (pod) return pod.domain ?? null; // first resolvable pod parent wins
    }
    return null;
  }

  function plantForBean(slug: string): Plant | null {
    const bean = beanBySlug.get(slug);
    if (!bean) return null;
    // A direct plant parent wins; then the first resolvable pod's first plant.
    for (const p of parentsWithPrefix(bean.parents, PLANT_PREFIX)) {
      const plant = plantBySlug.get(p);
      if (plant) return plant;
    }
    for (const podSlug of parentsWithPrefix(bean.parents, POD_PREFIX)) {
      const pod = podBySlug.get(podSlug);
      if (!pod) continue;
      for (const pl of parentsWithPrefix(pod.parents, PLANT_PREFIX)) {
        const plant = plantBySlug.get(pl);
        if (plant) return plant;
      }
    }
    return null;
  }

  const timeline: TimelineEntry[] = sprouts
    .map((sprout) => {
      const beanSlug = parentsWithPrefix(sprout.parents, BEAN_PREFIX)[0];
      const bean = beanSlug ? (beanBySlug.get(beanSlug) ?? null) : null;
      return {
        sprout,
        bean,
        plant: bean ? plantForBean(bean.slug) : null,
        domain: bean ? domainForBean(bean.slug) : null,
      };
    })
    .sort((a, b) => byDateDesc(a.sprout, b.sprout));

  return {
    getPlants: () => plants,
    podsForPlant: (slug) => podsByPlant.get(slug) ?? [],
    beansForPlant: (slug) => beansByPlant.get(slug) ?? [],
    unrootedPods: () => unrooted,
    plantForBean,
    getPods: () => pods,
    beansForPod: (slug) => beansByPod.get(slug) ?? [],
    standaloneBeans: () => standalone,
    getBean: (slug) => beanBySlug.get(slug),
    sproutsForBean: (slug) => sproutsByBean.get(slug) ?? [],
    timelineSprouts: () => timeline,
    domainForBean,
  };
}

// Blank parts fall through (|| not ??): a hand-authored { en: "", fr: "Nom" }
// resolves to "Nom" instead of rendering blank and failing name validation.
export function resolveText(value: Text | undefined, lang: "en" | "fr" = "en"): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value[lang] || value.en || value.fr || "";
}

// Strict single-part access — the form-prefill path (B1). Unlike resolveText it
// NEVER falls back across languages: prefilling the fr box with a fallback would
// silently copy en into it and corrupt the data on save. A plain string counts as
// the en part; the other part is empty.
export function textPart(value: Text | undefined, lang: "en" | "fr"): string {
  if (value == null) return "";
  if (typeof value === "string") return lang === "en" ? value : "";
  return value[lang] ?? "";
}

// Inverse of the paired form inputs (B1): both blank → "", fr blank → a plain
// string (keeps simple content simple), otherwise { en?, fr } with a blank en
// omitted. Trims both parts.
export function composeText(en: string, fr: string): Text {
  const e = en.trim();
  const f = fr.trim();
  if (!f) return e;
  return e ? { en: e, fr: f } : { fr: f };
}

// Public projection of the vault. The security-sensitive rules live here:
//  - a Sprout is public ONLY when state === "published" (missing state hides it);
//  - a Plant/Pod/Bean is visible unless explicitly visibility === "private";
//  - privacy cascades DOWNWARD, fail-closed, from the plant tier all the way
//    down (plant → pod → bean → sprout): a Pod whose every EXISTING plant
//    parent was filtered out is dropped, a Bean whose every EXISTING pod AND
//    plant parent was filtered out is dropped (a kept parent in EITHER tier
//    shelters it), and a Sprout whose every EXISTING bean parent was filtered
//    out is dropped. Dangling (nonexistent) parent refs are ignored, so
//    standalone-by-dangling items are preserved (matches buildDataset);
//  - each kept Sprout's AND Plant's relations[] is scrubbed to refs whose
//    TARGET survives this same projection (kept sprout/bean/pod/plant) —
//    draft, private, cascaded-out, dangling, and unknown-prefix targets all
//    drop, so a hidden slug can never leak through a property dump or the
//    graph endpoint;
//  - Bees are default-PRIVATE and cascade-exempt: only an explicit
//    visibility === "public" survives, and each survivor's serves[] is
//    scrubbed to kept plants.
// Pure: input objects are never mutated; scrubbing yields a fresh object.
export function filterPublic(raw: RawGarden): RawGarden {
  const rawPlants = raw.plants ?? [];
  const rawPods = raw.pods ?? [];
  const rawBeans = raw.beans ?? [];
  const rawSprouts = raw.sprouts ?? [];
  const rawBees = raw.bees ?? [];

  const keptPlants = rawPlants.filter((p) => p.visibility !== "private");
  const plantExists = new Set(rawPlants.map((p) => p.slug));
  const plantKept = new Set(keptPlants.map((p) => p.slug));

  const pods = rawPods.filter(
    (p) =>
      p.visibility !== "private" &&
      !allExistingParentsFiltered(p.parents, [[PLANT_PREFIX, plantExists, plantKept]]),
  );
  const podExists = new Set(rawPods.map((p) => p.slug));
  const podKept = new Set(pods.map((p) => p.slug));

  const beans = rawBeans.filter(
    (b) =>
      b.visibility !== "private" &&
      !allExistingParentsFiltered(b.parents, [
        [POD_PREFIX, podExists, podKept],
        [PLANT_PREFIX, plantExists, plantKept],
      ]),
  );
  const beanExists = new Set(rawBeans.map((b) => b.slug));
  const beanKept = new Set(beans.map((b) => b.slug));

  const keptSprouts = rawSprouts.filter(
    (s) =>
      s.state === "published" &&
      !allExistingParentsFiltered(s.parents, [[BEAN_PREFIX, beanExists, beanKept]]),
  );

  // Relations may point at sprouts, so the kept-sprout set must exist BEFORE
  // any relation (on sprouts OR plants) is judged.
  const sproutKept = new Set(keptSprouts.map((s) => s.slug));
  const refSurvives = (ref: string): boolean =>
    ref.startsWith(SPROUT_PREFIX)
      ? sproutKept.has(ref.slice(SPROUT_PREFIX.length))
      : ref.startsWith(BEAN_PREFIX)
        ? beanKept.has(ref.slice(BEAN_PREFIX.length))
        : ref.startsWith(POD_PREFIX)
          ? podKept.has(ref.slice(POD_PREFIX.length))
          : ref.startsWith(PLANT_PREFIX) && plantKept.has(ref.slice(PLANT_PREFIX.length));

  const sprouts = keptSprouts.map((s) => scrubRelations(s, refSurvives));
  const plants = keptPlants.map((p) => scrubRelations(p, refSurvives));

  // Bees are default-PRIVATE (the opposite of every content tier) and sit
  // outside the cascades: only an explicit "public" survives, and each
  // survivor's serves[] is scrubbed to kept plants so a hidden plant slug can
  // never leak through an operational doc.
  const bees = rawBees
    .filter((b) => b.visibility === "public")
    .map((b) => {
      const serves = (Array.isArray(b.serves) ? b.serves : []).filter(
        (ref) => ref.startsWith(PLANT_PREFIX) && plantKept.has(ref.slice(PLANT_PREFIX.length)),
      );
      return Array.isArray(b.serves) && serves.length === b.serves.length ? b : { ...b, serves };
    });

  return { plants, pods, beans, sprouts, bees };
}

// True when the item has parent refs that EXIST in the dataset (across every
// given tier) and ALL such existing parents were filtered out. Dangling refs
// are ignored; a single kept parent in ANY tier shelters the item.
function allExistingParentsFiltered(
  parents: string[] | undefined,
  tiers: [prefix: string, exists: Set<string>, kept: Set<string>][],
): boolean {
  let existing = 0;
  for (const [prefix, exists, kept] of tiers) {
    for (const slug of parentsWithPrefix(parents, prefix)) {
      if (!exists.has(slug)) continue;
      if (kept.has(slug)) return false;
      existing++;
    }
  }
  return existing > 0;
}

// Shared relations scrub for kept sprouts and plants. Tolerates malformed
// shapes from direct DB writes (the validator's "moderate" level never
// re-checks pre-existing docs): a non-array field and non-{kind,ref}-string
// entries drop fail-closed instead of throwing — one bad doc must not 500
// every public read.
function scrubRelations<T extends { relations?: Relation[] }>(
  item: T,
  refSurvives: (ref: string) => boolean,
): T {
  if (!item.relations) return item; // absent stays absent — never materialize []
  if (!Array.isArray(item.relations)) return { ...item, relations: [] };
  const scrubbed = item.relations.filter(
    (rel) =>
      rel != null &&
      typeof rel.kind === "string" &&
      typeof rel.ref === "string" &&
      refSurvives(rel.ref),
  );
  return scrubbed.length === item.relations.length ? item : { ...item, relations: scrubbed };
}

// Upward publish cascade — the write-time mirror of filterPublic's downward
// projection (spec §6.2). For the given sprout, returns the EXISTING bean parents
// and their EXISTING pod parents that must be made public so a published
// sprout never dangles under a private parent. Dangling refs are ignored, exactly
// as filterPublic ignores them. Pure; visibility is not consulted (idempotent flip).
export function publishCascade(
  raw: RawGarden,
  sproutSlug: string,
): { podSlugs: string[]; beanSlugs: string[] } {
  const pods = raw.pods ?? [];
  const beans = raw.beans ?? [];
  const sprouts = raw.sprouts ?? [];

  const sprout = sprouts.find((s) => s.slug === sproutSlug);
  if (!sprout) return { podSlugs: [], beanSlugs: [] };

  const beanBySlug = new Map(beans.map((b) => [b.slug, b]));
  const podExists = new Set(pods.map((p) => p.slug));

  const beanSlugs = [
    ...new Set(parentsWithPrefix(sprout.parents, BEAN_PREFIX).filter((s) => beanBySlug.has(s))),
  ];

  const podSlugs = new Set<string>();
  for (const beanSlug of beanSlugs) {
    const bean = beanBySlug.get(beanSlug)!;
    for (const p of parentsWithPrefix(bean.parents, POD_PREFIX)) {
      if (podExists.has(p)) podSlugs.add(p);
    }
  }

  return { podSlugs: [...podSlugs], beanSlugs };
}

// Bean-level core of the downward recompute (roadmap A1/A2). Given candidate bean
// slugs, returns the EXISTING beans left with NO published sprout, and their
// EXISTING pod parents left with NO public bean once those beans flip. Callers
// that still have the sprout (un-publish) adapt via unpublishCascade; callers that
// no longer do (delete) pass the bean parents they captured BEFORE the write and
// evaluate against the post-write dataset. Dangling/unknown slugs are ignored and
// flip-target visibility is not consulted (idempotent flip), exactly as publishCascade.
export function unpublishCascadeForBeans(
  raw: RawGarden,
  beanSlugs: string[],
): { podSlugs: string[]; beanSlugs: string[] } {
  const pods = raw.pods ?? [];
  const beans = raw.beans ?? [];
  const sprouts = raw.sprouts ?? [];

  const beanBySlug = new Map(beans.map((b) => [b.slug, b]));
  const podExists = new Set(pods.map((p) => p.slug));

  // A bean is sheltered while ANY published sprout still points at it.
  const shelteredBeans = new Set<string>();
  for (const s of sprouts) {
    if (s.state !== "published") continue;
    for (const b of parentsWithPrefix(s.parents, BEAN_PREFIX)) shelteredBeans.add(b);
  }

  const flipping = new Set(
    beanSlugs.filter((s) => beanBySlug.has(s) && !shelteredBeans.has(s)),
  );

  const podCandidates = new Set<string>();
  for (const beanSlug of flipping) {
    for (const p of parentsWithPrefix(beanBySlug.get(beanSlug)!.parents, POD_PREFIX)) {
      if (podExists.has(p)) podCandidates.add(p);
    }
  }

  // A pod is sheltered while any surviving public bean still points at it —
  // the same "public unless explicitly private" rule filterPublic reads by.
  const shelteredPods = new Set<string>();
  for (const b of beans) {
    if (flipping.has(b.slug) || b.visibility === "private") continue;
    for (const p of parentsWithPrefix(b.parents, POD_PREFIX)) shelteredPods.add(p);
  }

  return {
    podSlugs: [...podCandidates].filter((p) => !shelteredPods.has(p)),
    beanSlugs: [...flipping],
  };
}

// Downward un-publish recompute — the inverse of publishCascade (roadmap A1). Thin
// adapter over unpublishCascadeForBeans keyed by the sprout's bean parents, read
// from the dataset (unknown sprout slug → no-op). Evaluate against a dataset loaded
// AFTER the sprout's state was saved, so its own state counts (still-published → no-op).
export function unpublishCascade(
  raw: RawGarden,
  sproutSlug: string,
): { podSlugs: string[]; beanSlugs: string[] } {
  const sprout = (raw.sprouts ?? []).find((s) => s.slug === sproutSlug);
  if (!sprout) return { podSlugs: [], beanSlugs: [] };
  return unpublishCascadeForBeans(raw, parentsWithPrefix(sprout.parents, BEAN_PREFIX));
}

let cached: Dataset | null = null;

// Reads data/garden.yml once at first call (build time), then caches.

export function getDataset(): Dataset {
  if (!cached) {
    const file = readFileSync(join(process.cwd(), "data", "garden.yml"), "utf8");
    // CORE_SCHEMA omits js-yaml's !!timestamp type, so dates like `2025-09-28`
    // stay plain strings instead of becoming Date objects.
    const parsed = yaml.load(file, { schema: yaml.CORE_SCHEMA }) as RawGarden;
    cached = buildDataset(parsed ?? {});
  }
  return cached;
}
