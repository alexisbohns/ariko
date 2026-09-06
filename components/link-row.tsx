import { resolveText, type PlatformLink } from "@/lib/data";
import type { Lang } from "@/lib/locale";
import { platformLabel } from "@/lib/platforms";
// Shared, not local — lib/url.ts records why an href is guarded and an <img src>
// deliberately is not.
import { isHttpUrl } from "@/lib/url";

/**
 * Where a thing can be found — a row of destinations.
 *
 * A SERVER component, and it must stay one. `lib/server-safe-source.test.ts`
 * enforces the two rules that make that true, because a violation passes tsc,
 * npm test AND npm run build: no `"use client"`, and no `lucide-react` (which
 * routes every icon through an Icon.mjs carrying the directive, so one import
 * is one client boundary in a zone whose whole rule is that it has none).
 *
 * TEXT CHIPS, NO BRAND MARKS, and that is a decision rather than a gap.
 * components/public-icons.tsx tells you to copy lucide's `__iconNode` out of
 * node_modules and "do not eyeball it", and its test compares each copy against
 * lucide's own geometry so a drifted path fails rather than shipping. There is
 * no such source in this tree for a Spotify or Instagram mark — lucide has no
 * brand icons, and simple-icons is not a dependency — so drawing five brand
 * paths by hand would be exactly the eyeballing that rule forbids, with nothing
 * able to catch a wrong one. Marks are a follow-up with a real prerequisite.
 *
 * Never framed, never inline. That is the whole difference between this and
 * components/media.tsx, and it is why PlatformLink is not a Media.
 */
const CHIP =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-heading text-xs uppercase tracking-widest transition-colors";

export function LinkRow({
  links,
  lang = "en",
  label = "Where to find this",
}: {
  links?: PlatformLink[];
  lang?: Lang;
  /** The nav's accessible name. The plant and the sprout say different things. */
  label?: string;
}) {
  // The same contract MediaList has: nothing to show is nothing rendered, not
  // an empty container with a gap around it.
  if (!links || links.length === 0) return null;

  return (
    <nav aria-label={label} className="not-prose flex flex-wrap gap-2">
      {links.map((link, i) => {
        // A stored label wins; the platform's own name is the fallback. Blank
        // parts fall through inside resolveText, so { en: "", fr: "…" } still
        // reads rather than rendering an empty chip.
        const text = resolveText(link.label, lang).trim() || platformLabel(link.platform);

        // Non-http renders as text: visible, copyable, not clickable.
        if (!isHttpUrl(link.url)) {
          return (
            <span key={`${i}-${link.url}`} className={`${CHIP} text-muted-foreground`}>
              {text}
            </span>
          );
        }

        return (
          <a
            key={`${i}-${link.url}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${CHIP} hover:bg-accent`}
          >
            {text}
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        );
      })}
    </nav>
  );
}
