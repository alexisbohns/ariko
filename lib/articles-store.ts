// lib/articles-store.ts
//
// Mongo glue for the articles write door (POST /api/articles). Shape
// validation lives in lib/articles.ts; this module owns everything that
// needs the database: locating the container, refusing to clobber reviewed
// work, and the actual upserts. Same discipline as upsertDigestDrafts in
// synthesis-store.ts — pre-check every refusal before writing anything.
//
// Since the journal model (spec 2026-10-10-journal-model §3 "Doors") an
// article IS a bean: its `content` is written onto the bean directly, and no
// companion sprout is created. The old shape — a private bean plus a
// `type:"article"` sprout `<slug>-0` under it — is exactly what
// scripts/migrate-journal.ts folds away, so this door must not recreate it.

import { getDb } from "./db";
import {
  resolveText,
  BEAN_PREFIX,
  PLANT_PREFIX,
  POD_PREFIX,
  type Bean,
  type Plant,
  type Pod,
} from "./data";
import { extractRefs, mergeMirrored } from "./entity-refs";
import type { ArticlesPayload } from "./articles";

export type WriteResult =
  | { ok: true; written: number; narrative: boolean }
  | { ok: false; refused: string[] };

// container ref -> { collection, slug }. validateArticlesPayload has already
// checked the grammar on the route, but this module does not lean on that for
// anything a write depends on: an unknown prefix falls through to "beans" and
// is refused as unknown by the pre-check, and articles under a bean are
// refused again below, so a caller that reaches writeArticles by another
// path gets the same answer the route gives.
function resolveContainer(ref: string): { collection: "plants" | "pods" | "beans"; slug: string } {
  if (ref.startsWith(PLANT_PREFIX)) return { collection: "plants", slug: ref.slice(PLANT_PREFIX.length) };
  if (ref.startsWith(POD_PREFIX)) return { collection: "pods", slug: ref.slice(POD_PREFIX.length) };
  return { collection: "beans", slug: ref.slice(BEAN_PREFIX.length) };
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
  // a published bean in the same batch must see BOTH reasons in one
  // response, not retry after fixing the first only to hit the second.

  if (payload.narrative !== undefined) {
    const container = await db
      .collection<Plant | Pod | Bean>(collection)
      .findOne(
        { slug: containerSlug },
        { projection: { _id: 0, visibility: 1, content: 1, projected: 1 } },
      );
    if (!container) {
      refused.push(`${payload.container} (unknown)`);
    } else if ("projected" in container && container.projected) {
      // A projected bean is machine-owned: derived from a pollen feed and
      // rebuilt from it (lib/projected-beans.ts), so prose written onto it
      // belongs to nobody and survives no rebuild. Not this door's to write.
      refused.push(`${payload.container} (projected)`);
    } else if (container.visibility === "public" && resolveText(container.content).trim() !== "") {
      // Containers (plants/pods/beans) carry visibility but no `state` — there is no
      // "published" flag to check the way sprouts have one. "public AND already
      // has non-blank prose" is the closest available proxy for "a human
      // published this narrative": once it's live with content, a machine
      // rewrite of that content is the exact clobber this door must refuse.
      refused.push(payload.container);
    }
  }

  // A bean holds no beans: an article posted under one would upsert a bean
  // whose parent is a bean, which the garden's tree never reads. The validator
  // refuses this shape at the route; the store refuses it again on its own.
  if (collection === "beans" && articles.length > 0)
    refused.push(`${payload.container} (a bean holds no beans)`);

  if (articles.length > 0) {
    const beanSlugs = articles.map((a) => a.slug);
    const existingBeans = await db
      .collection<Bean>("beans")
      .find(
        { slug: { $in: beanSlugs } },
        { projection: { _id: 0, slug: 1, visibility: 1, projected: 1 } },
      )
      .toArray();
    const bySlug = new Map(existingBeans.map((b) => [b.slug, b]));
    for (const slug of beanSlugs) {
      const stored = bySlug.get(slug);
      if (stored === undefined) continue;
      // A bean this door creates is always private ($setOnInsert below), so
      // an existing bean that is PUBLIC can only have gotten that way through
      // a human act (the admin's publishCascade, or a hand-authored bean
      // promoted public). Refuse rather than silently rewrite its name,
      // description or — since an article IS the bean's narrative — its
      // content. STRICTER than the container rule on purpose: a container is
      // refused only when public AND carrying prose, because a blank public
      // plant is still waiting for its first narrative; a public bean is
      // refused on visibility alone, because this door never made it public
      // and so has no claim on anything about it any more.
      if (stored.visibility === "public") refused.push(`bean:${slug}`);
      // Same rule as the bean: container above — a projected bean is rebuilt
      // from its pollen feed, so a narrative written onto it survives nothing.
      else if (stored.projected) refused.push(`bean:${slug} (projected)`);
    }
  }

  if (refused.length > 0) return { ok: false, refused };

  // --- Writes ---

  if (payload.narrative !== undefined) {
    // The pre-check above already turned a missing or already-public-with-prose
    // container into a refusal, so by construction this container exists and
    // was writable at read time. But a human can publish it (flip to public
    // AND give it prose) in the gap between that read and this write — the
    // same race the bean upsert below closes with `visibility: { $ne: "public" }`
    // in its filter. containerStillWritableFilter() re-asserts the identical
    // "not public-with-prose" condition in the filter itself, so if the race
    // fires the update simply fails to match (matchedCount 0) instead of
    // silently overwriting prose that just went live. Never touch visibility
    // here either way — this door cannot publish a container any more than it
    // can publish a bean. Note that `relations` is replaced wholesale
    // (mergeMirrored over `undefined`, not over the stored list): a relation
    // hand-authored on a still-private container is lost on the next post,
    // which the public-with-prose refusal covers for the common case — once
    // a human has published it, this door no longer writes it at all.
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
    // Bean upsert — the article's whole write. The pre-check above already
    // refused any existing PUBLIC or projected bean, so every bean reaching
    // this write is either brand new or private — this door's own earlier
    // draft, or an unpublished hand-authored one — and rewriting its name,
    // description and narrative in place is the "re-post corrects an
    // unreviewed draft" case the door exists for, not a clobber.
    // parents/visibility are $setOnInsert only regardless: set once at
    // creation and never re-asserted, so a later re-post can't undo a human
    // re-parenting or publishing the bean that happens after this write.
    //
    // The filter's `visibility: { $ne: "public" }` is load-bearing, not
    // decorative. The pre-check read visibilities once, before any write in
    // this batch began; if a human publishes this exact bean in the gap
    // between that read and this write, re-asserting not-public in the filter
    // means the upsert can't match the now-public doc and instead tries to
    // INSERT a duplicate slug, which collides on the beans.slug unique index
    // and throws — aborting the batch loudly instead of silently overwriting
    // reviewed work. The same guard covers `projected`.
    //
    // `relations` is replaced wholesale, exactly as the container narrative's
    // is above and for the same reason: the door writes unreviewed drafts,
    // and once a human has published the bean it no longer writes it at all.
    // `a.date` is validated on the route and recorded NOWHERE here — a bean
    // has no date; see ArticleInput's docblock.
    const beanSet: Record<string, unknown> = {
      name: a.name,
      content: a.content,
      relations: mergeMirrored(undefined, extractRefs(a.content)),
    };
    // Blank means blank in EVERY language: resolveText falls back across parts,
    // so { fr: "…" } is non-blank here and correctly reaches the bean.
    if (resolveText(a.description ?? "").trim() !== "") beanSet.description = a.description;
    await db.collection("beans").updateOne(
      { slug: a.slug, visibility: { $ne: "public" }, projected: { $exists: false } },
      {
        $set: beanSet,
        $setOnInsert: { parents: [payload.container], visibility: "private" },
      },
      { upsert: true },
    );
  }

  return { ok: true, written: articles.length, narrative: payload.narrative !== undefined };
}
