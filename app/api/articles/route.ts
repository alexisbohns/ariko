import { hasValidToken, singleToken } from "../../../lib/auth";
import { validateArticlesPayload, type ArticlesPayload } from "../../../lib/articles";
import { writeArticles } from "../../../lib/articles-store";
import { isV2Shape, validateArticlesV2, type ArticlesV2 } from "../../../lib/articles-v2";
import { writeArticlesV2 } from "../../../lib/articles-v2-store";
import { authorizeRepo } from "../../../lib/repo-token-store";
import { cloudinaryCloudName } from "../../../lib/article-images";
import { UPLOAD_FOLDER } from "../../../lib/storage";
import { isDuplicateKeyError } from "../../../lib/seeds";
import { revalidateGarden } from "../../../lib/garden-cache";

export const dynamic = "force-dynamic";

// Guarded long-form write door: drafts only, all-or-nothing, never publishes.
//
// Two tokens, two shapes (spec 2026-11-14 §2–3). A per-repo token
// (`ariko_<pod>_…`, lib/repo-token-store.ts) takes the v2 shape — essays and
// narratives scoped to its pod. The legacy ARTICLES_TOKEN keeps the original
// container/narrative/articles shape until it is retired. Each refuses the
// other's shape with a 400 that names the right one, so a sibling halfway
// through the migration learns what to change from the error alone.
//
// Legacy (slice 4 spec §2): validation order is token → JSON → pure payload
// rules (no DB yet) → the store, which pre-checks every DB refusal before
// writing anything. The door structurally cannot publish, and never changes
// visibility.
export async function POST(request: Request): Promise<Response> {
  const header = request.headers.get("authorization");
  const repo = await authorizeRepo(header);
  const legacyOk = !repo.ok && hasValidToken(header, singleToken(process.env.ARTICLES_TOKEN));
  if (!repo.ok && !legacyOk) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }

  if (repo.ok) return v2(repo.pod, body);
  if (isV2Shape(body))
    return Response.json(
      { error: "essays/narratives needs a repo token (npm run token:mint in the Ariko repo)" },
      { status: 400 },
    );
  return legacy(body);
}

async function v2(pod: string, body: unknown): Promise<Response> {
  if (!isV2Shape(body))
    return Response.json(
      { error: "a repo token posts { essays, narratives } — see the ariko-article skill" },
      { status: 400 },
    );
  const cloud = cloudinaryCloudName(process.env.CLOUDINARY_URL);
  const valid = validateArticlesV2(body, { host: cloud ? { cloud, folder: UPLOAD_FOLDER } : undefined });
  if (!valid.ok) return Response.json({ error: valid.error }, { status: 400 });

  let result;
  try {
    result = await writeArticlesV2(pod, body as ArticlesV2);
  } catch (err) {
    if (isDuplicateKeyError(err))
      return Response.json(
        { error: "refused: a slug was taken mid-write; re-read with /api/articles/ping and retry" },
        { status: 409 },
      );
    throw err;
  }
  if (!result.ok) {
    // A mid-batch race can leave earlier items written (all private/draft);
    // say so, and invalidate for them, rather than claim nothing happened.
    if (result.written.length > 0) revalidateGarden();
    return Response.json({ error: "refused", refused: result.refused, written: result.written }, { status: 409 });
  }
  revalidateGarden();
  const admin = [
    ...result.narratives.map((s) => (s === pod ? `/admin/pod/${s}` : `/admin/bean/${s}`)),
    ...result.essays.map((s) => `/admin/sprout/${s}`),
  ];
  return Response.json({ ...result, admin });
}

async function legacy(body: unknown): Promise<Response> {
  const valid = validateArticlesPayload(body);
  if (!valid.ok) return Response.json({ error: valid.error }, { status: 400 });

  let result;
  try {
    result = await writeArticles(body as ArticlesPayload);
  } catch (err) {
    // writeArticles's bean upsert filters on `visibility: { $ne: "public" }`;
    // if a human publishes that exact bean in the gap between its pre-check
    // read and this write, the filter stops matching and the upsert attempts
    // an INSERT that collides on the beans.slug unique index (Mongo 11000).
    // That is a DIFFERENT situation from the pre-check `refused` array below
    // (which means "we read the visibility before writing and it was already
    // public") — this means "it went public DURING this very write" — so the
    // error text is deliberately distinct, though the status code and door
    // semantics (nothing clobbered, safe to re-read and retry) match.
    // Untested: reproducing this deterministically requires a write to land
    // inside writeArticles's own gap between its read and its upsert, which
    // this route's tests cannot force without faking the race.
    if (isDuplicateKeyError(err)) {
      return Response.json(
        { error: "refused: a bean was published mid-write; nothing clobbered — re-read and retry" },
        { status: 409 },
      );
    }
    throw err;
  }
  if (!result.ok) {
    return Response.json(
      { error: "refused: already reviewed", refused: result.refused },
      { status: 409 },
    );
  }
  revalidateGarden();
  return Response.json(result);
}
