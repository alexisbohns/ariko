// app/api/articles/ping/route.ts
//
// The article door's setup check (spec 2026-11-14 §3.1, plant scope §2.1). The
// ariko-article skill calls this before writing a word: a 200 proves the token,
// the network allowlist and the URL in one request, and the body is the scope
// the agent may anchor to — the plant, its pods, and the beans under them (or
// directly under the plant). Read-only; reads the database directly (never the
// cached garden — a pod planted a minute ago must be visible here).

import { authorizeRepo } from "../../../../lib/repo-token-store";
import { getDb } from "../../../../lib/db";
import {
  resolveText,
  parentsWithPrefix,
  PLANT_PREFIX,
  POD_PREFIX,
  type Bean,
  type Plant,
  type Pod,
} from "../../../../lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const repo = await authorizeRepo(request.headers.get("authorization"));
  if (!repo.ok) return Response.json({ error: "unauthorized" }, { status: 401 });

  const db = await getDb();
  const plant = await db.collection<Plant>("plants").findOne({ slug: repo.plant }, { projection: { _id: 1 } });
  if (!plant) return Response.json({ error: `plant ${repo.plant} no longer exists` }, { status: 404 });

  const pods = await db
    .collection<Pod>("pods")
    .find({ parents: `${PLANT_PREFIX}${repo.plant}` }, { projection: { _id: 0, slug: 1, name: 1, visibility: 1 } })
    .sort({ slug: 1 })
    .toArray();
  const podSlugs = new Set(pods.map((p) => p.slug));
  const beans = await db
    .collection<Bean>("beans")
    .find(
      { parents: { $in: [`${PLANT_PREFIX}${repo.plant}`, ...pods.map((p) => `${POD_PREFIX}${p.slug}`)] } },
      { projection: { _id: 0, slug: 1, name: 1, visibility: 1, projected: 1, parents: 1 } },
    )
    .sort({ slug: 1 })
    .toArray();

  return Response.json({
    plant: repo.plant,
    pods: pods.map((p) => ({ slug: p.slug, name: resolveText(p.name), visibility: p.visibility ?? "public" })),
    beans: beans.map((b) => ({
      slug: b.slug,
      name: resolveText(b.name),
      // The first of this plant's pods it sits in; null for a bean directly under the plant.
      pod: parentsWithPrefix(b.parents, POD_PREFIX).find((s) => podSlugs.has(s)) ?? null,
      visibility: b.visibility ?? "public",
      ...(b.projected ? { projected: true } : {}),
    })),
  });
}
