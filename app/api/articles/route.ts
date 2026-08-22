import { hasValidToken, singleToken } from "../../../lib/auth";
import { validateArticlesPayload, type ArticlesPayload } from "../../../lib/articles";
import { writeArticles } from "../../../lib/articles-store";
import { isDuplicateKeyError } from "../../../lib/seeds";

export const dynamic = "force-dynamic";

// Guarded long-form write door (slice 4 spec §2): drafts only, all-or-nothing.
// Validation order: token → JSON → pure payload rules (no DB yet) → the store,
// which pre-checks every DB refusal before writing anything. The door
// structurally cannot publish, and never changes visibility.
export async function POST(request: Request): Promise<Response> {
  const tokens = singleToken(process.env.ARTICLES_TOKEN);
  if (!hasValidToken(request.headers.get("authorization"), tokens)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const valid = validateArticlesPayload(body);
  if (!valid.ok) return Response.json({ error: valid.error }, { status: 400 });

  let result;
  try {
    result = await writeArticles(body as ArticlesPayload);
  } catch (err) {
    // writeArticles's sprout upsert filters on `state: { $exists: false }`; if
    // a human publishes that exact sprout in the gap between its pre-check
    // read and this write, the filter stops matching and the upsert attempts
    // an INSERT that collides on the sprouts.slug unique index (Mongo 11000).
    // That is a DIFFERENT situation from the pre-check `refused` array below
    // (which means "we read the state before writing and it was already
    // set") — this means "it was set DURING this very write" — so the error
    // text is deliberately distinct, though the status code and door
    // semantics (nothing clobbered, safe to re-read and retry) match.
    // Untested: reproducing this deterministically requires a write to land
    // inside writeArticles's own gap between its read and its upsert, which
    // this route's tests cannot force without faking the race.
    if (isDuplicateKeyError(err)) {
      return Response.json(
        { error: "refused: a sprout was reviewed mid-write; nothing clobbered — re-read and retry" },
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
  return Response.json(result);
}
