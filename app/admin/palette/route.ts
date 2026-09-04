import { loadRawGarden } from "@/lib/store";
import { listSeeds } from "@/lib/seeds";
import { buildPaletteIndex } from "@/lib/palette";

/**
 * The command palette's index.
 *
 * It lives under /admin rather than /api, and that is the whole point:
 * middleware.ts matches "/admin/:path*" and already redirects an
 * unauthenticated request to the login page, so this route inherits the
 * session gate with ZERO new auth code — no token parsing, no second cookie
 * check, no new surface to get wrong. A sibling under /api/admin/… would fall
 * outside that matcher and would have to re-implement the gate.
 *
 * Fetched on open rather than server-rendered into the admin layout, which is
 * what keeps the palette an island that costs nothing until it is used: no
 * admin page's render cost changes because of it.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const [garden, seeds] = await Promise.all([loadRawGarden(), listSeeds({ status: "inbox" })]);
    return Response.json(
      { items: buildPaletteIndex({ garden, seeds }) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    // The client falls back to the four sections it builds itself — the
    // palette is never a dead box. Nothing here is worth leaking a stack for.
    return Response.json(
      { error: "index unavailable" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
