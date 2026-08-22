// lib/articles-store.ts
//
// Mongo glue for the articles write door (POST /api/articles). Shape
// validation lives in lib/articles.ts; this module owns everything that
// needs the database: locating the container, refusing to clobber reviewed
// work, and the actual upserts. Same discipline as upsertDigestDrafts in
// synthesis-store.ts — pre-check every refusal before writing anything.

import { getDb } from "./db";
import { resolveText, PLANT_PREFIX, POD_PREFIX, type Bean, type Plant, type Pod, type Sprout } from "./data";
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

// Mongo-side mirror of the JS refusal condition
// `visibility === "public" && resolveText(content).trim() !== ""`, expressed
// as its NEGATION ("still acceptable to write to"), so it can be embedded
// directly in an update filter — see writeArticles's narrative write for why.
// resolveText's fallback (content.en, else content.fr, else "") is
// reproduced with $cond/$ifNull; $type distinguishes the LocalizedText object
// shape from a plain string; $trim mirrors the JS-side .trim().
function containerStillWritableFilter(): Record<string, unknown> {
  const resolvedEn = { $ifNull: ["$content.en", ""] };
  const resolvedFr = { $ifNull: ["$content.fr", ""] };
  const resolvedText = {
    $cond: [
      { $eq: [{ $type: "$content" }, "object"] },
      { $cond: [{ $ne: [resolvedEn, ""] }, resolvedEn, resolvedFr] },
      { $ifNull: ["$content", ""] },
    ],
  };
  return {
    $or: [
      { visibility: { $ne: "public" } },
      { $expr: { $eq: [{ $trim: { input: resolvedText } }, ""] } },
    ],
  };
}

export async function writeArticles(payload: ArticlesPayload): Promise<WriteResult> {
  const db = await getDb();
  const { collection, slug: containerSlug } = resolveContainer(payload.container);
  const articles = payload.articles ?? [];
  const refused: string[] = [];

  // Refusal pre-checks happen before any write — an all-or-nothing batch, like
  // upsertDigestDrafts. Every check below runs regardless of whether an
  // earlier one already failed: a caller with, say, a missing container AND
  // a pre-published sprout in the same batch must see BOTH reasons in one
  // response, not retry after fixing the first only to hit the second.

  if (payload.narrative !== undefined) {
    const container = await db
      .collection<Plant | Pod>(collection)
      .findOne({ slug: containerSlug }, { projection: { _id: 0, visibility: 1, content: 1 } });
    if (!container) {
      refused.push(`${payload.container} (unknown)`);
    } else if (container.visibility === "public" && resolveText(container.content).trim() !== "") {
      // Containers (plants/pods) carry visibility but no `state` — there is no
      // "published" flag to check the way sprouts have one. "public AND already
      // has non-blank prose" is the closest available proxy for "a human
      // published this narrative": once it's live with content, a machine
      // rewrite of that content is the exact clobber this door must refuse.
      refused.push(payload.container);
    }
  }

  if (articles.length > 0) {
    const beanSlugs = articles.map((a) => a.slug);
    const existingBeans = await db
      .collection<Bean>("beans")
      .find({ slug: { $in: beanSlugs } }, { projection: { _id: 0, slug: 1, visibility: 1 } })
      .toArray();
    const visibilityBySlug = new Map(existingBeans.map((b) => [b.slug, b.visibility]));
    for (const slug of beanSlugs) {
      // Same proxy as the container rule: a bean this door creates is always
      // private ($setOnInsert below), so an existing bean that is PUBLIC can
      // only have gotten that way through a human act (the admin's
      // publishCascade, or a hand-authored bean promoted public). Refuse
      // rather than silently rewrite its name/description — the same
      // "existence + public = reviewed" signal the container check already
      // uses, since beans, like containers, carry visibility but no state.
      if (visibilityBySlug.get(slug) === "public") refused.push(`bean:${slug}`);
    }

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
    // The pre-check above already turned a missing or already-public-with-prose
    // container into a refusal, so by construction this container exists and
    // was writable at read time. But a human can publish it (flip to public
    // AND give it prose) in the gap between that read and this write — the
    // exact same race the sprout path closes with `state: { $exists: false }`
    // in its filter. containerStillWritableFilter() re-asserts the identical
    // "not public-with-prose" condition in the filter itself, so if the race
    // fires the update simply fails to match (matchedCount 0) instead of
    // silently overwriting prose that just went live. Never touch visibility
    // here either way — this door cannot publish a container any more than it
    // can publish a sprout.
    const result = await db.collection(collection).updateOne(
      { slug: containerSlug, ...containerStillWritableFilter() },
      {
        $set: {
          content: payload.narrative,
          relations: mergeMirrored(undefined, extractRefs(payload.narrative)),
        },
      },
    );
    if (result.matchedCount === 0) {
      return { ok: false, refused: [payload.container] };
    }
  }

  for (const a of articles) {
    // Bean upsert: the pre-check above already refused any existing PUBLIC
    // bean, so every bean reaching this write is either brand new or private
    // — this door's own earlier draft, or an unpublished hand-authored one —
    // and updating its name/description in place is correct, not a clobber.
    // parents/visibility are $setOnInsert only regardless: set once at
    // creation and never re-asserted, so a later re-post can't undo a human
    // re-parenting or publishing the bean that happens after this write.
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
