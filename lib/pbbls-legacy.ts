import type { Bean, RawGarden } from "./data";

// Issue #54 / spec 2026-09-04-pbbls-legacy-bean-retirement-design.
//
// A pure, idempotent transform over a RawGarden, in the shape lib/retier.ts
// established: the catalogs below are the single definition of "migrated", and
// both halves of the migration read them — scripts/migrate-pbbls-legacy.ts for
// Mongo, lib/pbbls-legacy.test.ts to prove data/garden.yml's hand edit matches.
//
// The YAML half is NOT written by a script, deliberately. migrate-retier.ts
// ends with yaml.dump, which erases comments; garden.yml's comments are
// load-bearing and one of them is the warning this very work adds. So the file
// is edited by hand and the suite asserts it is already a fixed point here.

// The four seeded beans that retire. `pbbls-ios` and `pbbls-path` slug-shadow
// the pods of the same name; `pbbls-webapp` is superseded by the pod tier;
// `pbbls-recorder` never held anything.
export const LEGACY_BEANS = ["pbbls-webapp", "pbbls-ios", "pbbls-path", "pbbls-recorder"] as const;

// Beans already authored through the admin, living only in Mongo. They are
// deliberately absent from STUB_BEANS and from data/garden.yml: migrate $sets
// name and description on every run, so a seed entry would revert their real
// titles to placeholders.
export const AUTHORED_BEANS = [
  "pbbls-wallet",
  "pbbls-market",
  "pbbls-d8",
  "pbbls-connections",
  "pbbls-cut",
  "pbbls-unbuilt",
] as const;

// Spec 2026-09-02 §6 calls these "milestone sprouts": dated, content-free, one
// per shipped deliverable. The twelve below were seeded as `feature`; retyping
// makes them one set with the deliverable.shipped events #55 will import.
export const MILESTONE_TYPE = "milestone" as const;

// The twelve changelog sprouts, and the bean each one actually advances.
// Four assignments are named in spec 2026-09-02 §9.2; three were judgement
// calls, decided domain-first (spec 2026-09-04 §4). Slugs are NOT renamed: the
// webapp-/ios- prefix records which surface shipped it, which is the fact a
// milestone ledger wants.
export const SPROUT_MAP: Record<string, string> = {
  "pbbls-webapp-core": "pbbls-path-nav",
  "pbbls-webapp-color": "pbbls-colour",
  "pbbls-webapp-record-flow": "pbbls-record-flow",
  "pbbls-webapp-emotion-pearl": "pbbls-valence",
  "pbbls-webapp-pwa": "pbbls-web-shell",
  "pbbls-webapp-karma": "pbbls-wallet",
  "pbbls-ios-core": "pbbls-ios-jump",
  "pbbls-ios-record-flow": "pbbls-record-flow",
  "pbbls-ios-profile": "pbbls-ios-jump",
  "pbbls-ios-pebble-detail": "pbbls-path-nav",
  "pbbls-ios-pebble-render": "pbbls-render",
  "pbbls-ios-emotion-colored-pebbles": "pbbls-colour",
};

// The 36 beans of spec 2026-09-02 §5.3 that do not exist yet, seeded PRIVATE so
// every ref in payloads/_SLUGS.md resolves and no writing agent has to link a
// bean that renders as a hole. Names and descriptions are PLACEHOLDERS: when a
// bean is authored, delete its entry from data/garden.yml (see the comment
// there) so the next migrate cannot revert the real title.
export const STUB_BEANS: Bean[] = [
  // pod:pbbls-web
  { slug: "pbbls-web-shell", name: "The Web Shell", parents: ["pod:pbbls-web"], visibility: "private", description: "The PWA that stopped pretending to be offline." },
  { slug: "pbbls-polaroid-wall", name: "The Polaroid Wall", parents: ["pod:pbbls-web"], visibility: "private", description: "The Path as a wall of polaroids, dealt round-robin rather than height-balanced." },
  // pod:pbbls-ios
  { slug: "pbbls-ios-jump", name: "The Jump to SwiftUI", parents: ["pod:pbbls-ios"], visibility: "private", description: "Web to native, and the TestFlight builds that settled whether Pebbles was an app." },
  { slug: "pbbls-ios-two-composers", name: "Two Composers", parents: ["pod:pbbls-ios"], visibility: "private", description: "Why two ways of writing a pebble coexist on purpose." },
  { slug: "pbbls-ios-live-activity", name: "The Live Activity", parents: ["pod:pbbls-ios"], visibility: "private", description: "The Live Activity that device evidence killed, and the widget target left behind." },
  // pod:pbbls-android
  { slug: "pbbls-android-six-days", name: "Six Days to Parity", parents: ["pod:pbbls-android"], visibility: "private", description: "Bootstrap to parity in six days, across nine milestones." },
  { slug: "pbbls-android-parity-audit", name: "The Parity Audit", parents: ["pod:pbbls-android"], visibility: "private", description: "The July audit that counted what was still missing, and found three defects in shipped code." },
  { slug: "pbbls-android-divergence", name: "Deliberate Divergence", parents: ["pod:pbbls-android"], visibility: "private", description: "Duplicated draft glue, kept on purpose, with the debt named and enforceable." },
  // pod:pbbls-backstage
  { slug: "pbbls-analytics", name: "Analytics", parents: ["pod:pbbls-backstage"], visibility: "private", description: "Measuring the product without making the numbers the point." },
  { slug: "pbbls-moderation", name: "The Glyph Queue", parents: ["pod:pbbls-backstage"], visibility: "private", description: "Human review of submitted glyphs, and the read that exists because the market policy would not be weakened." },
  { slug: "pbbls-lab", name: "The Lab", parents: ["pod:pbbls-backstage"], visibility: "private", description: "The in-app changelog, prefilled from the clipboard." },
  // pod:pbbls-record
  { slug: "pbbls-record-flow", name: "The Recording Flow", parents: ["pod:pbbls-record"], visibility: "private", description: "Fifteen steps, then seconds, then two composers." },
  { slug: "pbbls-cards", name: "The Cards", parents: ["pod:pbbls-record"], visibility: "private", description: "Beck, hidden in plain sight." },
  { slug: "pbbls-drafts", name: "Drafts", parents: ["pod:pbbls-record"], visibility: "private", description: "Keeping the half-formed thoughts — a table of its own, never a status column." },
  // pod:pbbls-pebble
  { slug: "pbbls-valence", name: "Valence", parents: ["pod:pbbls-pebble"], visibility: "private", description: "How a memory became a shape." },
  { slug: "pbbls-wobble", name: "The Wobble", parents: ["pod:pbbls-pebble"], visibility: "private", description: "The petroglyph wobble, computed at runtime on the device." },
  { slug: "pbbls-glyph-carving", name: "Carving a Glyph", parents: ["pod:pbbls-pebble"], visibility: "private", description: "How a symbol gets drawn by hand, submitted, and accepted." },
  { slug: "pbbls-render", name: "The Render Engine", parents: ["pod:pbbls-pebble"], visibility: "private", description: "Compose once on the server, parse everywhere." },
  { slug: "pbbls-colour", name: "Colour", parents: ["pod:pbbls-pebble"], visibility: "private", description: "Emotion categories, palettes, and per-surface tinting." },
  // pod:pbbls-path
  { slug: "pbbls-path-nav", name: "The Path", parents: ["pod:pbbls-path"], visibility: "private", description: "Neither a list, nor a thread, nor stories." },
  { slug: "pbbls-collections", name: "Collections", parents: ["pod:pbbls-path"], visibility: "private", description: "Stack, Pack and Track — three ways of gathering pebbles." },
  // pod:pbbls-karma
  { slug: "pbbls-reward-not-prison", name: "Reward, Not Prison", parents: ["pod:pbbls-karma"], visibility: "private", description: "An economy that rewards recording without ever becoming a streak to protect." },
  { slug: "pbbls-badges", name: "Badges", parents: ["pod:pbbls-karma"], visibility: "private", description: "Achievements — idempotent, permanent, and paid at unlock." },
  // pod:pbbls-souls
  { slug: "pbbls-souls-not-users", name: "Souls, Not Users", parents: ["pod:pbbls-souls"], visibility: "private", description: "Why the people in someone's pebbles are called souls." },
  { slug: "pbbls-domains-greek", name: "The Greek Domains", parents: ["pod:pbbls-souls"], visibility: "private", description: "Five Greek domains seeded, and the eighteen plain-English ones entered four days later." },
  { slug: "pbbls-emotions", name: "The Emotion Model", parents: ["pod:pbbls-souls"], visibility: "private", description: "The emotion model as it actually shipped." },
  // pod:pbbls-public
  { slug: "pbbls-profiles-handles", name: "Handles", parents: ["pod:pbbls-public"], visibility: "private", description: "A handle is a pointer, not an archive." },
  { slug: "pbbls-sharing", name: "Sharing", parents: ["pod:pbbls-public"], visibility: "private", description: "What a share link exposes — one row, and nothing else." },
  { slug: "pbbls-privacy-grades", name: "Privacy Grades", parents: ["pod:pbbls-public"], visibility: "private", description: "Secret and private, as connections-visible and shared." },
  { slug: "pbbls-deletion-consent", name: "Deletion & Consent", parents: ["pod:pbbls-public"], visibility: "private", description: "Anonymising rather than destroying, so what someone bought keeps rendering." },
  // pod:pbbls-atelier
  { slug: "pbbls-naming", name: "Nomen Omen", parents: ["pod:pbbls-atelier"], visibility: "private", description: "How Pebbles got its name." },
  { slug: "pbbls-pivot", name: "The Pivot", parents: ["pod:pbbls-atelier"], visibility: "private", description: "From Beck's columns to a pebble." },
  { slug: "pbbls-psychology", name: "The Psychology", parents: ["pod:pbbls-atelier"], visibility: "private", description: "Beck, Barrett, Maslow, Kahneman, Clear, Lembke, SDT." },
  { slug: "pbbls-agentic", name: "The Agentic Method", parents: ["pod:pbbls-atelier"], visibility: "private", description: "One author, and the co-author trailers on most of the commits." },
  { slug: "pbbls-arkaik", name: "Arkaik", parents: ["pod:pbbls-atelier"], visibility: "private", description: "Sixty-seven nodes to four hundred and sixty — the map that updates itself." },
  { slug: "pbbls-harnesses", name: "The Harnesses", parents: ["pod:pbbls-atelier"], visibility: "private", description: "Proof rather than simulation — the audit programme, and the contract harnesses that became a merge gate." },
];

const legacy = new Set<string>(LEGACY_BEANS);

/**
 * Retires the legacy beans, seeds the missing stubs, and files the twelve
 * changelog sprouts under the beans they advance.
 *
 * Two rules, both about not destroying authored work:
 *  - a stub is only ever ADDED; a slug that already exists is skipped whole, so
 *    the catalog can never overwrite a name or a description;
 *  - a sprout moves only if SPROUT_MAP names it. Nothing is inferred from a
 *    slug prefix.
 *
 * Idempotent: f(f(x)) deep-equals f(x), which is what lets one set of
 * assertions cover both the pre- and post-migration garden.
 */
export function retireLegacyBeans(raw: RawGarden): RawGarden {
  const inBeans = raw.beans ?? [];
  const kept = inBeans.filter((b) => !legacy.has(b.slug));
  // `present` is derived from the SURVIVORS, not from the input: a slug that is
  // both retired and stubbed must come back as the stub in one pass, not vanish
  // on the first run and reappear on the second.
  const present = new Set(kept.map((b) => b.slug));

  const beans = [
    ...kept,
    ...STUB_BEANS.filter((b) => !present.has(b.slug)).map((b) => structuredClone(b)),
  ];

  const sprouts = (raw.sprouts ?? []).map((s) => {
    // Own properties only: every slug is a legal key, and a sprout slugged
    // `constructor` would otherwise inherit Object.prototype and re-parent onto
    // a ref built from a function source.
    if (!Object.hasOwn(SPROUT_MAP, s.slug)) return s;
    const target = SPROUT_MAP[s.slug];
    // The parents array is REPLACED, not appended to: these twelve are seeded
    // changelog sprouts with exactly one parent, and the whole point is to move
    // them off the bean that retires. A second parent would be dropped — which
    // is why the move is by explicit catalog entry and never by slug prefix.
    const parents = [`bean:${target}`];
    if (s.type === MILESTONE_TYPE && JSON.stringify(s.parents) === JSON.stringify(parents)) return s;
    return { ...s, parents, type: MILESTONE_TYPE };
  });

  // Spread raw first so unknown top-level keys pass through untouched.
  return { ...raw, beans, sprouts };
}
