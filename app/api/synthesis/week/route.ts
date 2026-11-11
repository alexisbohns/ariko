import { hasValidToken, singleToken } from "../../../../lib/auth";
import { bucketWeek, isValidWeekId, weekBounds } from "../../../../lib/synthesis";
import { loadHoursSnapshot } from "../../../../lib/hours-store";
import { weekHours } from "../../../../lib/hours-aggregate";
import { loadWeekMaterial, listDigestBeanSlugs } from "../../../../lib/synthesis-store";

export const dynamic = "force-dynamic";

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
  const [material, digestBeans, hoursSnapshot] = await Promise.all([
    loadWeekMaterial(),
    listDigestBeanSlugs(),
    loadHoursSnapshot(),
  ]);
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
    // The curated digest beans (spec §3): a plant with material but no
    // digest-<plant> container here has no destination to draft into —
    // the routine mentions it in the wrap's quiet/skipped line instead.
    digestBeans: [...digestBeans].sort(),
    // Work-hours tally for the wrap (work-hours spec §7); null before the first sync.
    hours: hoursSnapshot ? weekHours(hoursSnapshot, bounds.start, bounds.end) : null,
  });
}
