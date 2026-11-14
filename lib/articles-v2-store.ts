// lib/articles-v2-store.ts
//
// Mongo glue for the v2 article door (spec 2026-11-14 §3.3, plant scope §2.1).
// The token names a PLANT — a repo is a plant, and a plant has many pods.
// Everything this module writes must be inside it: one of the plant's pods, a
// bean under one of them (or directly under the plant), a bean this same
// payload creates under one of its pods, or an essay anchored to any of those
// or to the plant itself. Every refusal is pre-checked before any write; a
// mid-batch race returns what was written in `written`. The writes re-assert
// their preconditions in their filters so a human publishing mid-write turns
// into a refusal, not a clobber.
//
// It never writes `state: "published"` or `visibility` on anything but a bean
// it creates (private). Relations hand-authored in the admin are kept:
// mergeMirrored over the STORED list, never over `undefined` — the v2 door is
// an edit path for drafts a human may already have touched.
//
// ABSENT `visibility` MEANS PUBLIC (lib/data.ts), so every "is it reviewed?"
// check here reads `(visibility ?? "public") === "public"` and every write
// filter demands `visibility: "private"` outright — never `$ne: "public"`.
// A pod is writable only while PRIVATE (even blank: a public one would put the
// door's text live unreviewed); a bean, only while private and not projected.
// A narrative or `about` slug that names one of the plant's pods means the pod,
// even if a bean shares it. A bean listed under pods of two plants can be
// written by either plant's token (accepted).
//
// An essay with no `about` is about the whole plant: it is written with a
// `plant:` parent and no `about`, the sprout model's plant-level entry — a
// sprout carries one or the other, never both (updateSproutAnchor's rule).

import { getDb } from "./db";
import {
  resolveText,
  PLANT_PREFIX,
  POD_PREFIX,
  BEAN_PREFIX,
  type Bean,
  type Plant,
  type Pod,
  type Sprout,
  type Text,
} from "./data";
import { extractRefs, mergeMirrored } from "./entity-refs";
import { createBean, createSprout, SlugExistsError } from "./botanical";
import type { ArticlesV2 } from "./articles-v2";

export type V2Result =
  // `written` lists refs (pod:/bean:/sprout:) in write order — the route turns them into admin links.
  | { ok: true; essays: string[]; narratives: string[]; written: string[] }
  | { ok: false; refused: string[]; written: string[] };

const isPublic = (x: { visibility?: string }) => (x.visibility ?? "public") === "public";

const asParts = (text: Text): Record<string, string | undefined> =>
  typeof text === "string" ? { en: text } : { ...text };

// Posted languages overwrite; stored languages the post does not mention stay.
// Two plain strings stay a plain string.
function mergeText(stored: Text | undefined, posted: Text): Text {
  if (stored === undefined || (typeof stored === "string" && typeof posted === "string")) return posted;
  return { ...asParts(stored), ...asParts(posted) } as Text;
}

const ownsEssay = (s: Sprout, plant: string) =>
  s.kind === "essay" && s.source?.kind === "article-door" && s.source.externalId === plant;

export async function writeArticlesV2(plant: string, payload: ArticlesV2): Promise<V2Result> {
  const db = await getDb();
  const essays = payload.essays ?? [];
  const narratives = payload.narratives ?? [];
  const refused: string[] = [];
  const written: string[] = [];
  const failed = (...why: string[]): V2Result => ({ ok: false, refused: why, written });

  const plantDoc = await db.collection<Plant>("plants").findOne({ slug: plant }, { projection: { _id: 1 } });
  if (!plantDoc) return failed(`plant:${plant} (unknown)`);

  const pods = await db
    .collection<Pod>("pods")
    .find({ parents: `${PLANT_PREFIX}${plant}` }, { projection: { _id: 0 } })
    .toArray();
  const podBySlug = new Map(pods.map((p) => [p.slug, p]));
  const beans = await db
    .collection<Bean>("beans")
    .find(
      { parents: { $in: [`${PLANT_PREFIX}${plant}`, ...pods.map((p) => `${POD_PREFIX}${p.slug}`)] } },
      { projection: { _id: 0 } },
    )
    .toArray();
  const beanBySlug = new Map(beans.map((b) => [b.slug, b]));
  const podList = pods.map((p) => p.slug).join(", ") || "none — add a pod in the admin first";

  // --- Narratives: scope and refusals ---
  const narrativeBeanSlugs = narratives.map((n) => n.slug).filter((s) => !podBySlug.has(s));
  const elsewhere = await db
    .collection<Bean>("beans")
    .find(
      { slug: { $in: narrativeBeanSlugs.filter((s) => !beanBySlug.has(s)) } },
      { projection: { _id: 0, slug: 1 } },
    )
    .toArray();
  const elsewhereSlugs = new Set(elsewhere.map((b) => b.slug));
  // Another plant's POD: refused, never mistaken for a new bean — creating one
  // would put a bean and a pod under the same slug.
  const foreignPods = await db
    .collection<Pod>("pods")
    .find({ slug: { $in: narrativeBeanSlugs } }, { projection: { _id: 0, slug: 1 } })
    .toArray();
  const foreignPodSlugs = new Set(foreignPods.map((p) => p.slug));
  // new bean slug → the pod it is created under
  const created = new Map<string, string>();

  for (const n of narratives) {
    const podDoc = podBySlug.get(n.slug);
    if (podDoc) {
      // Only a PRIVATE pod is writable, even with blank content: on a public one
      // the door's text would go live unreviewed.
      if (n.pod !== undefined) refused.push(`pod:${n.slug} (pod: is for a bean only)`);
      else if (isPublic(podDoc)) refused.push(`pod:${n.slug} (already reviewed)`);
      continue;
    }
    const bean = beanBySlug.get(n.slug);
    if (bean) {
      // `pod` on an existing bean is accepted only when it is already there, so
      // re-posting the payload that created it stays safe. Moving is the admin's.
      if (n.pod !== undefined && !(bean.parents ?? []).includes(`${POD_PREFIX}${n.pod}`))
        refused.push(`bean:${n.slug} (not in pod ${n.pod} — move it in the admin)`);
      else if (isPublic(bean)) refused.push(`bean:${n.slug} (already reviewed)`);
      // Same test as the write filter (`projected: { $exists: false }`).
      else if (bean.projected !== undefined) refused.push(`bean:${n.slug} (projected)`);
    } else if (foreignPodSlugs.has(n.slug)) {
      refused.push(`pod:${n.slug} (not in plant ${plant})`);
    } else if (elsewhereSlugs.has(n.slug)) {
      refused.push(`bean:${n.slug} (not in plant ${plant})`);
    } else if (n.name === undefined) {
      refused.push(`bean:${n.slug} (a new bean needs a name)`);
    } else if (n.pod === undefined || !podBySlug.has(n.pod)) {
      refused.push(`bean:${n.slug} (a new bean needs pod: one of ${podList})`);
    } else {
      created.set(n.slug, n.pod);
    }
  }

  // --- Essays: scope and refusals ---
  const inScope = (slug: string) => podBySlug.has(slug) || beanBySlug.has(slug) || created.has(slug);
  const toRef = (slug: string) => (podBySlug.has(slug) ? `${POD_PREFIX}${slug}` : `${BEAN_PREFIX}${slug}`);

  const stored = await db
    .collection<Sprout>("sprouts")
    .find({ slug: { $in: essays.map((e) => e.slug) } }, { projection: { _id: 0 } })
    .toArray();
  const storedBySlug = new Map(stored.map((s) => [s.slug, s]));

  for (const e of essays) {
    for (const a of e.about ?? []) if (!inScope(a)) refused.push(`${e.slug}: about ${a} is not in plant ${plant}`);
    const existing = storedBySlug.get(e.slug);
    if (!existing) continue;
    if (existing.state === "published" || existing.state === "private")
      refused.push(`sprout:${e.slug} (already reviewed)`);
    else if (!ownsEssay(existing, plant) || (existing.state ?? "draft") !== "draft")
      refused.push(`sprout:${e.slug} (not written by this door)`);
  }

  if (refused.length > 0) return failed(...refused);

  // --- Writes: narratives first, so a bean created here exists for an essay's about ---
  for (const n of narratives) {
    const set: Record<string, unknown> = {};
    const podDoc = podBySlug.get(n.slug);
    const base = podDoc ?? beanBySlug.get(n.slug);
    const stamp = (field: "name" | "description" | "content", posted: Text | undefined) => {
      if (posted !== undefined) set[field] = mergeText(base?.[field] as Text | undefined, posted);
    };
    stamp("content", n.content);
    stamp("name", n.name);
    if (n.description !== undefined && resolveText(n.description).trim() !== "") stamp("description", n.description);

    if (podDoc) {
      set.relations = mergeMirrored(podDoc.relations, extractRefs(set.content as Text));
      const r = await db.collection("pods").updateOne({ slug: n.slug, visibility: "private" }, { $set: set });
      if (r.matchedCount === 0) return failed(`pod:${n.slug} (already reviewed)`);
      written.push(`${POD_PREFIX}${n.slug}`);
    } else if (created.has(n.slug)) {
      try {
        await createBean({
          slug: n.slug,
          name: n.name as Text,
          description: n.description ?? "",
          podSlug: created.get(n.slug) as string,
          plantSlug: null,
          content: n.content,
          relations: mergeMirrored(undefined, extractRefs(n.content)),
        });
      } catch (err) {
        if (err instanceof SlugExistsError) return failed(`bean:${n.slug} (created meanwhile)`);
        throw err;
      }
      written.push(`${BEAN_PREFIX}${n.slug}`);
    } else {
      set.relations = mergeMirrored(beanBySlug.get(n.slug)?.relations, extractRefs(set.content as Text));
      const r = await db
        .collection("beans")
        .updateOne({ slug: n.slug, visibility: "private", projected: { $exists: false } }, { $set: set });
      if (r.matchedCount === 0) return failed(`bean:${n.slug} (already reviewed)`);
      written.push(`${BEAN_PREFIX}${n.slug}`);
    }
  }

  for (const e of essays) {
    // One anchor or the other, never both: about the named pods/beans, or the plant.
    const anchor = e.about ? { about: e.about.map(toRef) } : { parents: [`${PLANT_PREFIX}${plant}`] };
    const existing = storedBySlug.get(e.slug);
    if (existing) {
      const content = mergeText(existing.content, e.content);
      const set: Record<string, unknown> = {
        name: mergeText(existing.name, e.name),
        content,
        date: e.date,
        ...anchor,
        relations: mergeMirrored(existing.relations, extractRefs(content)),
      };
      if (e.description !== undefined && resolveText(e.description).trim() !== "")
        set.description = mergeText(existing.description, e.description);
      const r = await db.collection<Sprout>("sprouts").updateOne(
        {
          slug: e.slug,
          kind: "essay",
          "source.kind": "article-door",
          "source.externalId": plant,
          $or: [{ state: "draft" }, { state: { $exists: false } }],
        },
        { $set: set, $unset: e.about ? { parents: "" } : { about: "" } },
      );
      if (r.matchedCount === 0) return failed(`sprout:${e.slug} (already reviewed)`);
      written.push(`sprout:${e.slug}`);
    } else {
      try {
        await createSprout({
          slug: e.slug,
          name: e.name,
          kind: "essay",
          date: e.date,
          description: e.description ?? "",
          ...anchor,
          content: e.content,
          state: "draft",
          media: [],
          source: { kind: "article-door", externalId: plant, capturedAt: new Date().toISOString() },
          relations: mergeMirrored(undefined, extractRefs(e.content)),
        });
      } catch (err) {
        if (err instanceof SlugExistsError) return failed(`sprout:${e.slug} (created meanwhile)`);
        throw err;
      }
      written.push(`sprout:${e.slug}`);
    }
  }

  return { ok: true, essays: essays.map((e) => e.slug), narratives: narratives.map((n) => n.slug), written };
}
