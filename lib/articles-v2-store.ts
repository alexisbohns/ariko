// lib/articles-v2-store.ts
//
// Mongo glue for the v2 article door (spec 2026-11-14 §3.3). The token names a
// pod; everything this module writes must be inside it: the pod itself, a bean
// whose parents include `pod:<pod>`, or a bean this same payload creates under
// it. Every refusal is pre-checked before any write; a mid-batch race returns
// what was written in `written`. The writes re-assert their preconditions in their
// filters so a human publishing mid-write turns into a refusal, not a clobber.
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
// A slug equal to the pod's always means the pod. A bean listed under two pods
// can be written by either pod's token (accepted).

import { getDb } from "./db";
import { resolveText, POD_PREFIX, BEAN_PREFIX, type Bean, type Pod, type Sprout, type Text } from "./data";
import { extractRefs, mergeMirrored } from "./entity-refs";
import { createBean, createSprout, SlugExistsError } from "./botanical";
import type { ArticlesV2 } from "./articles-v2";

export type V2Result =
  | { ok: true; essays: string[]; narratives: string[] }
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

const ownsEssay = (s: Sprout, pod: string) =>
  s.kind === "essay" && s.source?.kind === "article-door" && s.source.externalId === pod;

export async function writeArticlesV2(pod: string, payload: ArticlesV2): Promise<V2Result> {
  const db = await getDb();
  const essays = payload.essays ?? [];
  const narratives = payload.narratives ?? [];
  const refused: string[] = [];
  const written: string[] = [];
  const failed = (...why: string[]): V2Result => ({ ok: false, refused: why, written });

  const podDoc = await db.collection<Pod>("pods").findOne({ slug: pod }, { projection: { _id: 0 } });
  if (!podDoc) return failed(`pod:${pod} (unknown)`);

  const podBeans = await db
    .collection<Bean>("beans")
    .find({ parents: `${POD_PREFIX}${pod}` }, { projection: { _id: 0 } })
    .toArray();
  const beanBySlug = new Map(podBeans.map((b) => [b.slug, b]));

  // --- Narratives: scope and refusals ---
  const narrativeBeanSlugs = narratives.map((n) => n.slug).filter((s) => s !== pod);
  const elsewhere = await db
    .collection<Bean>("beans")
    .find(
      { slug: { $in: narrativeBeanSlugs.filter((s) => !beanBySlug.has(s)) } },
      { projection: { _id: 0, slug: 1 } },
    )
    .toArray();
  const elsewhereSlugs = new Set(elsewhere.map((b) => b.slug));
  const created = new Set<string>();

  for (const n of narratives) {
    if (n.slug === pod) {
      // Only a PRIVATE pod is writable, even with blank content: on a public one
      // the door's text would go live unreviewed.
      if (isPublic(podDoc)) refused.push(`pod:${pod} (already reviewed)`);
      continue;
    }
    const bean = beanBySlug.get(n.slug);
    if (bean) {
      if (isPublic(bean)) refused.push(`bean:${n.slug} (already reviewed)`);
      else if (bean.projected) refused.push(`bean:${n.slug} (projected)`);
    } else if (elsewhereSlugs.has(n.slug)) {
      refused.push(`bean:${n.slug} (not in pod ${pod})`);
    } else if (n.name === undefined) {
      refused.push(`bean:${n.slug} (a new bean needs a name)`);
    } else {
      created.add(n.slug);
    }
  }

  // --- Essays: scope and refusals ---
  const inScope = (slug: string) => slug === pod || beanBySlug.has(slug) || created.has(slug);
  const toRef = (slug: string) => (slug === pod ? `${POD_PREFIX}${slug}` : `${BEAN_PREFIX}${slug}`);

  const stored = await db
    .collection<Sprout>("sprouts")
    .find({ slug: { $in: essays.map((e) => e.slug) } }, { projection: { _id: 0 } })
    .toArray();
  const storedBySlug = new Map(stored.map((s) => [s.slug, s]));

  for (const e of essays) {
    for (const a of e.about) if (!inScope(a)) refused.push(`${e.slug}: about ${a} is not in pod ${pod}`);
    const existing = storedBySlug.get(e.slug);
    if (!existing) continue;
    if (existing.state === "published" || existing.state === "private")
      refused.push(`sprout:${e.slug} (already reviewed)`);
    else if (!ownsEssay(existing, pod) || (existing.state ?? "draft") !== "draft")
      refused.push(`sprout:${e.slug} (not written by this door)`);
  }

  if (refused.length > 0) return failed(...refused);

  // --- Writes: narratives first, so a bean created here exists for an essay's about ---
  for (const n of narratives) {
    const set: Record<string, unknown> = {};
    const base = n.slug === pod ? podDoc : beanBySlug.get(n.slug);
    const stamp = (field: "name" | "description" | "content", posted: Text | undefined) => {
      if (posted !== undefined) set[field] = mergeText(base?.[field] as Text | undefined, posted);
    };
    stamp("content", n.content);
    stamp("name", n.name);
    if (n.description !== undefined && resolveText(n.description).trim() !== "") stamp("description", n.description);

    if (n.slug === pod) {
      set.relations = mergeMirrored(podDoc.relations, extractRefs(set.content as Text));
      const r = await db.collection("pods").updateOne({ slug: pod, visibility: "private" }, { $set: set });
      if (r.matchedCount === 0) return failed(`pod:${pod} (already reviewed)`);
      written.push(`${POD_PREFIX}${pod}`);
    } else if (created.has(n.slug)) {
      try {
        await createBean({
          slug: n.slug,
          name: n.name as Text,
          description: n.description ?? "",
          podSlug: pod,
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
    const about = e.about.map(toRef);
    const existing = storedBySlug.get(e.slug);
    if (existing) {
      const content = mergeText(existing.content, e.content);
      const set: Record<string, unknown> = {
        name: mergeText(existing.name, e.name),
        content,
        date: e.date,
        about,
        relations: mergeMirrored(existing.relations, extractRefs(content)),
      };
      if (e.description !== undefined && resolveText(e.description).trim() !== "")
        set.description = mergeText(existing.description, e.description);
      const r = await db.collection<Sprout>("sprouts").updateOne(
        {
          slug: e.slug,
          kind: "essay",
          "source.kind": "article-door",
          "source.externalId": pod,
          $or: [{ state: "draft" }, { state: { $exists: false } }],
        },
        { $set: set, $unset: { parents: "" } },
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
          about,
          content: e.content,
          state: "draft",
          media: [],
          source: { kind: "article-door", externalId: pod, capturedAt: new Date().toISOString() },
          relations: mergeMirrored(undefined, extractRefs(e.content)),
        });
      } catch (err) {
        if (err instanceof SlugExistsError) return failed(`sprout:${e.slug} (created meanwhile)`);
        throw err;
      }
      written.push(`sprout:${e.slug}`);
    }
  }

  return { ok: true, essays: essays.map((e) => e.slug), narratives: narratives.map((n) => n.slug) };
}
