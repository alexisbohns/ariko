import { hasValidToken } from "../../../../lib/auth";
import { runSync } from "../../../../lib/pollen-run";

// The one guarded sync door (spec §7). One static bearer token (SYNC_TOKEN);
// an unset env var refuses everything — fail closed, like every other door.
export async function POST(request: Request): Promise<Response> {
  const token = process.env.SYNC_TOKEN;
  const tokens = token
    ? new Map([[token, new Set(["*"])]])
    : new Map<string, Set<string>>();
  if (!hasValidToken(request.headers.get("authorization"), tokens)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await runSync();
  const status = results.some((r) => r.status === "error") ? 502 : 200;
  return Response.json({ results }, { status });
}
