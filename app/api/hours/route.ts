import { hasValidToken, singleToken } from "../../../lib/auth";
import { MAX_SNAPSHOT_BYTES, validateSnapshot } from "../../../lib/hours";
import { aggregateUnit, parisToday } from "../../../lib/hours-aggregate";
import { loadHoursSnapshot, saveHoursSnapshot } from "../../../lib/hours-store";
import { revalidateHours } from "../../../lib/hours-cache";

export const dynamic = "force-dynamic";

// GET: public by decision (spec §1) — the snapshot plus derived aggregates.
export async function GET(): Promise<Response> {
  const snapshot = await loadHoursSnapshot();
  if (!snapshot) return Response.json({ snapshot: null }, { status: 404 });
  const today = parisToday();
  const agg = (u: typeof snapshot.global) => ({ key: u.key, ...aggregateUnit(u, snapshot.params.since, today) });
  return Response.json({
    snapshot,
    today,
    aggregates: [snapshot.global, ...snapshot.plants, ...snapshot.repos].map(agg),
  });
}

// POST: the guarded ingest door the hours-sync Action calls (spec §4, §8).
export async function POST(request: Request): Promise<Response> {
  const tokens = singleToken(process.env.HOURS_TOKEN);
  if (!hasValidToken(request.headers.get("authorization"), tokens)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const tooLarge = () =>
    Response.json({ error: `body too large (max ${MAX_SNAPSHOT_BYTES} bytes)` }, { status: 413 });
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_SNAPSHOT_BYTES) return tooLarge();
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_SNAPSHOT_BYTES) return tooLarge();

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = validateSnapshot(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  // The wipe guard (spec §8): an identity misconfiguration must not blank the page.
  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!force && parsed.snapshot.global.sessions.length === 0) {
    const stored = await loadHoursSnapshot();
    if (stored && stored.global.sessions.length > 0) {
      return Response.json(
        { error: "refused: snapshot has no sessions but the stored one does (pass ?force=1)" },
        { status: 409 },
      );
    }
  }
  await saveHoursSnapshot(parsed.snapshot);
  revalidateHours();
  return Response.json({
    ok: true,
    sessions: parsed.snapshot.global.sessions.length,
    generatedAt: parsed.snapshot.generatedAt,
  });
}
