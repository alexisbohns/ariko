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
// One door, one credential: a per-repo token (`ariko_<plant>_…`,
// lib/repo-token-store.ts) posting the { essays, narratives } shape, scoped to
// its plant (spec 2026-11-14). There is no second token. The shared
// ARTICLES_TOKEN and its `{ container, narrative, articles }` shape were
// retired on 2026-11-15 — they ran none of the plant-scope, image-host or
// staging checks below, which is the whole reason they went. A bearer that is
// not a live repo token is refused with the one 401 body, whatever else the
// environment holds, so a stale ARTICLES_TOKEN left in a deployment opens
// nothing (lib/articles-route-v2.test.ts pins that with the variable set).
//
// Validation order: token → JSON → pure payload rules (no DB yet) → the store,
// which pre-checks every DB refusal before writing anything. The door
// structurally cannot publish, and never changes visibility.
export async function POST(request: Request): Promise<Response> {
  const repo = await authorizeRepo(request.headers.get("authorization"));
  if (!repo.ok) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }

  return v2(repo.plant, body);
}

async function v2(plant: string, body: unknown): Promise<Response> {
  if (!isV2Shape(body))
    return Response.json(
      { error: "post { essays, narratives } — see the ariko-article skill" },
      { status: 400 },
    );
  const cloud = cloudinaryCloudName(process.env.CLOUDINARY_URL);
  const valid = validateArticlesV2(body, { host: cloud ? { cloud, folder: UPLOAD_FOLDER } : undefined });
  if (!valid.ok) return Response.json({ error: valid.error }, { status: 400 });

  let result;
  try {
    result = await writeArticlesV2(plant, body as ArticlesV2);
  } catch (err) {
    // Should be unreachable: createBean/createSprout map a duplicate to
    // SlugExistsError, which the store reports as refused with `written`. Kept as a safety net.
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
  // `pod:x` → /admin/pod/x, and so on: the store knows which kind each slug was.
  const { written, ...posted } = result;
  const admin = written.map((ref) => `/admin/${ref.replace(":", "/")}`);
  return Response.json({ ...posted, admin });
}
