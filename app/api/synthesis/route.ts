import { hasValidToken } from "../../../lib/auth";
import {
  isValidWeekId,
  validateDigestBatch,
  type DraftSprout,
} from "../../../lib/synthesis";
import {
  listDigestBeanSlugs,
  upsertDigestDrafts,
} from "../../../lib/synthesis-store";

// Guarded synthesis write door (slice 5 spec §4): drafts only, all-or-nothing.
// Validation order: token → shape → week grammar (no DB yet) → batch guard
// against the curated digest beans → upsert, which itself refuses to touch
// any sprout whose state is set (409). The door structurally cannot publish.
export async function POST(request: Request): Promise<Response> {
  const token = process.env.SYNTHESIS_TOKEN;
  const tokens = token
    ? new Map([[token, new Set(["*"])]])
    : new Map<string, Set<string>>();
  if (!hasValidToken(request.headers.get("authorization"), tokens)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { week?: unknown; sprouts?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const week = typeof body.week === "string" ? body.week : "";
  if (!isValidWeekId(week) || !Array.isArray(body.sprouts)) {
    return Response.json(
      { error: "body must be { week: 'YYYY-Wnn', sprouts: [...] }" },
      { status: 400 },
    );
  }
  const sprouts = body.sprouts as DraftSprout[];
  const beans = await listDigestBeanSlugs();
  const check = validateDigestBatch(week, sprouts, beans);
  if (!check.ok) return Response.json({ error: check.error }, { status: 400 });
  const result = await upsertDigestDrafts(sprouts);
  if (!result.ok) {
    return Response.json(
      { error: "refused: reviewed sprouts are not overwritable", refused: result.refused },
      { status: 409 },
    );
  }
  return Response.json({ week, written: result.written });
}
