// app/api/articles/ping/route.ts
//
// The article door's setup check (spec 2026-11-14 §3.1). The ariko-article
// skill calls this before writing a word: a 200 proves the token, the network
// allowlist and the URL in one request, and the body is the scope the agent may
// anchor to. Read-only; reads the pod and its beans directly (never the cached
// garden — a pod planted a minute ago must be visible here).

import { authorizeRepo } from "../../../../lib/repo-token-store";
import { getDb } from "../../../../lib/db";
import { resolveText, parentsWithPrefix, PLANT_PREFIX, POD_PREFIX, type Bean, type Pod } from "../../../../lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const repo = await authorizeRepo(request.headers.get("authorization"));
  if (!repo.ok) return Response.json({ error: "unauthorized" }, { status: 401 });

  const db = await getDb();
  const pod = await db.collection<Pod>("pods").findOne({ slug: repo.pod }, { projection: { _id: 0, parents: 1 } });
  if (!pod) return Response.json({ error: `pod ${repo.pod} no longer exists` }, { status: 404 });

  const beans = await db
    .collection<Bean>("beans")
    .find({ parents: `${POD_PREFIX}${repo.pod}` }, { projection: { _id: 0, slug: 1, name: 1, visibility: 1, projected: 1 } })
    .sort({ slug: 1 })
    .toArray();

  return Response.json({
    pod: repo.pod,
    plant: parentsWithPrefix(pod.parents, PLANT_PREFIX)[0] ?? null,
    beans: beans.map((b) => ({
      slug: b.slug,
      name: resolveText(b.name),
      visibility: b.visibility ?? "public",
      ...(b.projected ? { projected: true } : {}),
    })),
  });
}
