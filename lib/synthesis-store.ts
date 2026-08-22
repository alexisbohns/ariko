// lib/synthesis-store.ts
import { getDb } from "./db";
import { buildDataset, resolveText, type Sprout } from "./data";
import { loadRawGarden } from "./store";
import { extractRefs, mergeMirrored } from "./entity-refs";
import { listPollen } from "./pollen-store";
import {
  DIGEST_TYPE,
  refusedOverwrites,
  type DraftSprout,
  type WindowSprout,
} from "./synthesis";

// Mongo glue for the synthesis doors (slice 5 spec §4). Reads reuse the
// slice-4 stores; the only write is the draft upsert below.

export interface WeekMaterial {
  pollen: Awaited<ReturnType<typeof listPollen>>;
  sprouts: WindowSprout[];
  roster: string[];
}

// FULL union (private included) — the read door is guarded (spec §2).
export async function loadWeekMaterial(): Promise<WeekMaterial> {
  const raw = await loadRawGarden();
  const dataset = buildDataset(raw);
  const sprouts: WindowSprout[] = dataset.timelineSprouts().map((e) => ({
    slug: e.sprout.slug,
    type: e.sprout.type,
    date: e.sprout.date,
    plantSlug: e.plant?.slug ?? null,
    name: resolveText(e.sprout.name),
    description: resolveText(e.sprout.description),
  }));
  return {
    pollen: await listPollen(),
    sprouts,
    roster: (raw.plants ?? []).map((p) => p.slug),
  };
}

// The curated digest containers: beans whose slug is weekly-wrap or digest-*.
export async function listDigestBeanSlugs(): Promise<Set<string>> {
  const db = await getDb();
  const beans = await db
    .collection<{ slug: string }>("beans")
    .find(
      { slug: { $in: [/^digest-/, "weekly-wrap"] } },
      { projection: { _id: 0, slug: 1 } },
    )
    .toArray();
  return new Set(beans.map((b) => b.slug));
}

// Refusal checking is all-or-nothing: every slug's stored state is
// pre-checked before any write, and refusals abort the whole batch (spec §3
// idempotency). The write phase itself is not transactional, but every write
// is an idempotent draft upsert, so a re-POST after a mid-batch error
// converges.
export async function upsertDigestDrafts(
  drafts: DraftSprout[],
): Promise<{ ok: true; written: number } | { ok: false; refused: string[] }> {
  const db = await getDb();
  const slugs = drafts.map((d) => d.slug);
  const existing = await db
    .collection<Sprout>("sprouts")
    .find({ slug: { $in: slugs } }, { projection: { _id: 0, slug: 1, state: 1 } })
    .toArray();
  const states = new Map(existing.map((s) => [s.slug, s.state as string | undefined]));
  const refused = refusedOverwrites(slugs, states);
  if (refused.length > 0) return { ok: false, refused };
  for (const d of drafts) {
    // $set never includes `state`: a fresh insert has none (draft), and a
    // re-run leaves an existing (absent) state untouched. The pre-check above
    // reads states once; re-asserting state-absence in the filter here makes
    // the write collide loudly on the sprouts.slug unique index if a human
    // publish lands mid-batch (upsert then tries to insert a duplicate slug
    // and throws, aborting the batch) instead of silently clobbering a
    // reviewed sprout.
    await db.collection("sprouts").updateOne(
      { slug: d.slug, state: { $exists: false } },
      {
        $set: {
          name: d.name,
          type: DIGEST_TYPE,
          date: d.date,
          parents: d.parents,
          content: d.content,
          // Derived on every draft write (slice 3): the digest bee's prose can
          // embed entities, and the graph must see those edges without parsing.
          relations: mergeMirrored(undefined, extractRefs(d.content)),
          description: d.description ?? "",
        },
        $unset: { state: "" },
      },
      { upsert: true },
    );
  }
  return { ok: true, written: drafts.length };
}
