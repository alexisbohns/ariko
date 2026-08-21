import { hasValidToken, singleToken } from "../../../../lib/auth";
import { bucketWeek, isValidWeekId, weekBounds } from "../../../../lib/synthesis";
import { loadWeekMaterial } from "../../../../lib/synthesis-store";

// Guarded synthesis read door (slice 5 spec §4): the machine-readable twin of
// the beanstalk union, UNFILTERED — private envelopes and unpublished sprouts
// included, which is exactly why the token is not optional. Fail closed.
export async function GET(request: Request): Promise<Response> {
  const tokens = singleToken(process.env.SYNTHESIS_TOKEN);
  if (!hasValidToken(request.headers.get("authorization"), tokens)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const week = new URL(request.url).searchParams.get("week") ?? "";
  if (!isValidWeekId(week)) {
    return Response.json({ error: `invalid week id: ${week}` }, { status: 400 });
  }
  const bounds = weekBounds(week);
  const material = await loadWeekMaterial();
  const { plants, quiet } = bucketWeek(
    material.pollen,
    material.sprouts,
    material.roster,
    bounds,
  );
  return Response.json({
    week: { id: week, ...bounds },
    plants,
    quiet,
    roster: material.roster,
  });
}
