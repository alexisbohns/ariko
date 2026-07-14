import { filterPublic } from "@/lib/data";
import { loadRawSeed } from "@/lib/store";
import { toGraph } from "@/lib/graph";

// Data twin of the public pages: no auth, and it composes the same
// filterPublic projection, so it can never expose more than the public HTML
// already does. Read-per-request (D3 may add tagged caching later); DB errors
// propagate as 500, matching the public-page posture.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(toGraph(filterPublic(await loadRawSeed())));
}
