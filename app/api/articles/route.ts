import { hasValidToken, singleToken } from "../../../lib/auth";
import { validateArticlesPayload, type ArticlesPayload } from "../../../lib/articles";
import { writeArticles } from "../../../lib/articles-store";

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

  const result = await writeArticles(body as ArticlesPayload);
  if (!result.ok) {
    return Response.json(
      { error: "refused: already reviewed", refused: result.refused },
      { status: 409 },
    );
  }
  return Response.json(result);
}
