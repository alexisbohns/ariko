// lib/articles-v2-store.ts
//
// Mongo glue for the v2 article door (spec 2026-11-14 §3.3). The token names a
// pod; everything this module writes must be inside it: the pod itself, a bean
// whose parents include `pod:<pod>`, or a bean this same payload creates under
// it. Every refusal is collected before any write (all-or-nothing, as
// writeArticles does), and the writes re-assert their preconditions in their
// filters so a human publishing mid-write turns into a refusal, not a clobber.
//
// It never writes `state: "published"` or `visibility` on anything but a bean
// it creates (private). Relations hand-authored in the admin are kept:
// mergeMirrored over the STORED list, never over `undefined` — the v2 door is
// an edit path for drafts a human may already have touched.

import { getDb } from "./db";
import { resolveText, POD_PREFIX, BEAN_PREFIX, type Bean, type Pod, type Sprout, type Text } from "./data";
import { extractRefs, mergeMirrored } from "./entity-refs";
import { containerStillWritableFilter } from "./articles-store";
import { createSprout, SlugExistsError } from "./botanical";
import type { ArticlesV2 } from "./articles-v2";

export type V2Result =
  | { ok: true; essays: string[]; narratives: string[] }
  | { ok: false; refused: string[] };

const REPLACEABLE = (state: Sprout["state"]) => state === undefined || state === "draft";

export async function writeArticlesV2(pod: string, payload: ArticlesV2): Promise<V2Result> {
  const db = await getDb();
  const essays = payload.essays ?? [];
  const narratives = payload.narratives ?? [];
  const refused: string[] = [];

  const podDoc = await db
    .collection<Pod>("pods")
    .findOne({ slug: pod }, { projection: { _id: 0, slug: 1, visibility: 1, content: 1, relations: 1 } });
  if (!podDoc) return { ok: false, refused: [`pod:${pod} (unknown)`] };

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
      if (podDoc.visibility === "public" && resolveText(podDoc.content).trim() !== "")
        refused.push(`pod:${pod} (already reviewed)`);
      continue;
    }
    const bean = beanBySlug.get(n.slug);
    if (bean) {
      if (bean.visibility === "public") refused.push(`bean:${n.slug} (already reviewed)`);
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
  const scopeRefs = new Set([`${POD_PREFIX}${pod}`, ...[...beanBySlug.keys()].map((s) => `${BEAN_PREFIX}${s}`)]);

  const stored = await db
    .collection<Sprout>("sprouts")
    .find({ slug: { $in: essays.map((e) => e.slug) } }, { projection: { _id: 0 } })
    .toArray();
  const storedBySlug = new Map(stored.map((s) => [s.slug, s]));

  for (const e of essays) {
    for (const a of e.about) if (!inScope(a)) refused.push(`${e.slug}: about ${a} is not in pod ${pod}`);
    const existing = storedBySlug.get(e.slug);
    if (!existing) continue;
    if (!REPLACEABLE(existing.state)) refused.push(`sprout:${e.slug} (already reviewed)`);
    else if (!existing.about?.length || !existing.about.every((r) => scopeRefs.has(r)))
      refused.push(`sprout:${e.slug} (not in pod ${pod})`);
  }

  if (refused.length > 0) return { ok: false, refused };

  // --- Writes: narratives first, so a bean created here exists for an essay's about ---
  for (const n of narratives) {
    const set: Record<string, unknown> = { content: n.content };
    if (n.name !== undefined) set.name = n.name;
    if (n.description !== undefined && resolveText(n.description).trim() !== "") set.description = n.description;

    if (n.slug === pod) {
      set.relations = mergeMirrored(podDoc.relations, extractRefs(n.content));
      const r = await db.collection("pods").updateOne({ slug: pod, ...containerStillWritableFilter() }, { $set: set });
      if (r.matchedCount === 0) return { ok: false, refused: [`pod:${pod} (already reviewed)`] };
    } else if (created.has(n.slug)) {
      await db.collection("beans").insertOne({
        slug: n.slug,
        ...set,
        relations: mergeMirrored(undefined, extractRefs(n.content)),
        parents: [`${POD_PREFIX}${pod}`],
        visibility: "private",
      });
    } else {
      set.relations = mergeMirrored(beanBySlug.get(n.slug)?.relations, extractRefs(n.content));
      const r = await db
        .collection("beans")
        .updateOne({ slug: n.slug, visibility: { $ne: "public" }, projected: { $exists: false } }, { $set: set });
      if (r.matchedCount === 0) return { ok: false, refused: [`bean:${n.slug} (already reviewed)`] };
    }
  }

  for (const e of essays) {
    const about = e.about.map(toRef);
    const description: Text = e.description ?? "";
    const existing = storedBySlug.get(e.slug);
    if (existing) {
      const r = await db.collection<Sprout>("sprouts").updateOne(
        { slug: e.slug, state: { $nin: ["published", "private"] } },
        {
          $set: {
            name: e.name,
            description,
            content: e.content,
            date: e.date,
            about,
            relations: mergeMirrored(existing.relations, extractRefs(e.content)),
          },
          $unset: { parents: "" },
        },
      );
      if (r.matchedCount === 0) return { ok: false, refused: [`sprout:${e.slug} (already reviewed)`] };
    } else {
      try {
        await createSprout({
          slug: e.slug,
          name: e.name,
          kind: "essay",
          date: e.date,
          description,
          about,
          content: e.content,
          state: "draft",
          media: [],
          source: { kind: "article-door", externalId: pod, capturedAt: new Date().toISOString() },
          relations: mergeMirrored(undefined, extractRefs(e.content)),
        });
      } catch (err) {
        if (err instanceof SlugExistsError) return { ok: false, refused: [`sprout:${e.slug} (created meanwhile)`] };
        throw err;
      }
    }
  }

  return { ok: true, essays: essays.map((e) => e.slug), narratives: narratives.map((n) => n.slug) };
}
