// lib/articles-store.ts
//
// Mongo glue for the articles write door (POST /api/articles). Shape
// validation lives in lib/articles.ts; this module owns everything that
// needs the database: locating the container, refusing to clobber reviewed
// work, and the actual upserts. Same discipline as upsertDigestDrafts in
// synthesis-store.ts — pre-check every refusal before writing anything.

import { getDb } from "./db";
import { resolveText, PLANT_PREFIX, POD_PREFIX, type Plant, type Pod, type Sprout } from "./data";
import { extractRefs, mergeMirrored } from "./entity-refs";
import { sproutSlugFor, type ArticlesPayload } from "./articles";

export type WriteResult =
  | { ok: true; written: number; narrative: boolean }
  | { ok: false; refused: string[] };

// container ref -> { collection, slug }. Validated upstream by
// validateArticlesPayload, so the prefix is guaranteed to be one of the two.
function resolveContainer(ref: string): { collection: "plants" | "pods"; slug: string } {
  if (ref.startsWith(PLANT_PREFIX)) return { collection: "plants", slug: ref.slice(PLANT_PREFIX.length) };
  return { collection: "pods", slug: ref.slice(POD_PREFIX.length) };
}

export async function writeArticles(payload: ArticlesPayload): Promise<WriteResult> {
  const db = await getDb();
  const { collection, slug: containerSlug } = resolveContainer(payload.container);
  const articles = payload.articles ?? [];
  const refused: string[] = [];

  // Refusal pre-checks happen before any write — an all-or-nothing batch, like
  // upsertDigestDrafts. Nothing below this block mutates the database.

  let container: (Plant | Pod) | null = null;
  if (payload.narrative !== undefined) {
    container = await db
      .collection<Plant | Pod>(collection)
      .findOne({ slug: containerSlug }, { projection: { _id: 0, visibility: 1, content: 1 } });
    if (!container) {
      return { ok: false, refused: [`${payload.container} (unknown)`] };
    }
    // Containers (plants/pods) carry visibility but no `state` — there is no
    // "published" flag to check the way sprouts have one. "public AND already
    // has non-blank prose" is the closest available proxy for "a human
    // published this narrative": once it's live with content, a machine
    // rewrite of that content is the exact clobber this door must refuse.
    if (container.visibility === "public" && resolveText(container.content).trim() !== "") {
      refused.push(payload.container);
    }
  }

  if (articles.length > 0) {
    const sproutSlugs = articles.map((a) => sproutSlugFor(a.slug));
    const existing = await db
      .collection<Sprout>("sprouts")
      .find({ slug: { $in: sproutSlugs } }, { projection: { _id: 0, slug: 1, state: 1 } })
      .toArray();
    const stateBySlug = new Map(existing.map((s) => [s.slug, s.state]));
    for (const s of sproutSlugs) {
      if (stateBySlug.get(s) !== undefined) refused.push(s);
    }
  }

  if (refused.length > 0) return { ok: false, refused };

  // --- Writes ---

  if (payload.narrative !== undefined) {
    // Never touch visibility here — this door cannot publish a container any
    // more than it can publish a sprout.
    await db.collection(collection).updateOne(
      { slug: containerSlug },
      {
        $set: {
          content: payload.narrative,
          relations: mergeMirrored(undefined, extractRefs(payload.narrative)),
        },
      },
    );
  }

  for (const a of articles) {
    // Bean upsert: name is always refreshed; description only when a
    // non-blank one was given (an absent/blank description in a re-post must
    // not blank out one a human later wrote). parents/visibility are
    // $setOnInsert only — set once at creation and never re-asserted, so a
    // human who re-parents or publishes the bean afterwards isn't undone by a
    // later re-post of the same article.
    const beanSet: Record<string, unknown> = { name: a.name };
    if (a.description && a.description.trim() !== "") beanSet.description = a.description;
    await db.collection("beans").updateOne(
      { slug: a.slug },
      {
        $set: beanSet,
        $setOnInsert: { parents: [payload.container], visibility: "private" },
      },
      { upsert: true },
    );

    // Sprout upsert: the filter's `state: { $exists: false }` is load-bearing,
    // not decorative. The refusal pre-check above read stored states once,
    // before any write in this batch began; if a human publishes this exact
    // sprout in the gap between that read and this write, re-asserting
    // state-absence in the filter here means the upsert can't match the
    // now-published doc and instead tries to INSERT a duplicate slug, which
    // collides on the sprouts.slug unique index and throws — aborting the
    // batch loudly instead of silently overwriting reviewed work.
    await db.collection("sprouts").updateOne(
      { slug: sproutSlugFor(a.slug), state: { $exists: false } },
      {
        $set: {
          name: a.name,
          type: "article",
          date: a.date,
          description: a.description ?? "",
          parents: [`bean:${a.slug}`],
          content: a.content,
          relations: mergeMirrored(undefined, extractRefs(a.content)),
        },
        $unset: { state: "" },
      },
      { upsert: true },
    );
  }

  return { ok: true, written: articles.length, narrative: payload.narrative !== undefined };
}
