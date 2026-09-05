import { ArikoIcon } from "@/components/brand/ariko-icon";
import { IconLink } from "@/components/icon-link";
import { LangSwitch } from "@/components/lang-switch";
import { SproutIcon, WaypointsIcon } from "@/components/public-icons";
import type { Lang } from "@/lib/locale";

/**
 * The public zone's chrome: two fixed clusters where a header bar used to be.
 *
 * A SERVER component, and every part of it stays one — this is the half of the
 * slice that does NOT spend the zone's script budget. The glyphs are inline SVG
 * (components/public-icons.tsx) because lucide is "use client"; the hover
 * labels are CSS (components/icon-link.tsx) because the registry Tooltip is
 * too. A visitor with script off can still go everywhere.
 *
 * The mark and "Directory" both point at `/`. That duplication is in the header
 * this replaces, and it is kept deliberately: the mark is the brand, the icon
 * is a nav item, and a nav whose first item is missing reads as broken.
 *
 * The two nav glyphs are the ADMIN RAIL'S OWN — sprout for the directory of
 * plants, waypoints for the beanstalk. Two zones, one vocabulary: a visitor who
 * becomes the author finds the same glyph meaning the same thing.
 */
export function PublicChrome({ lang }: { lang: Lang }) {
  return (
    <>
      <nav
        aria-label="Site"
        className="fixed left-4 top-4 z-40 flex items-center gap-1 rounded-2xl border bg-card/80 p-1.5 shadow-lg backdrop-blur"
      >
        <IconLink href="/" label="Ariko">
          <ArikoIcon className="size-5 text-foreground" />
        </IconLink>
        <IconLink href="/" label="Directory">
          <SproutIcon className="size-4" />
        </IconLink>
        <IconLink href="/beanstalk" label="Beanstalk">
          <WaypointsIcon className="size-4" />
        </IconLink>
      </nav>

      {/* The language switch keeps its own anchor and its own aria-label — it
          is a link to `?lang=…`, not an icon, so it does not go through
          IconLink. */}
      <div className="fixed right-4 top-4 z-40 rounded-xl border bg-card/80 px-3 py-2 shadow-lg backdrop-blur">
        <LangSwitch lang={lang} />
      </div>
    </>
  );
}
