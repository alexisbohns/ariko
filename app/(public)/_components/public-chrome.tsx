import { ArikoIcon } from "@/components/brand/ariko-icon";
import { Chrome, ChromeLink } from "@/components/chrome";
import { LangSwitch } from "@/components/lang-switch";
import { SproutIcon, WaypointsIcon } from "@/components/public-icons";
import type { Lang } from "@/lib/locale";

/**
 * The public zone's chrome: two fixed clusters where a header bar used to be.
 *
 * A SERVER component, and every part of it stays one — this is the half of the
 * zone that does NOT spend its script budget. The glyphs are inline SVG
 * (components/public-icons.tsx) because lucide is "use client"; the hover labels
 * are CSS (components/chrome.tsx) because the registry Tooltip is too. A visitor
 * with script off can still go everywhere.
 *
 * The shell itself is no longer this file's: `Chrome` and `ChromeLink` are the
 * admin rail's shell as well, which is what the shared-surfaces slice was for.
 * What used to be a hand-rolled `<nav>` plus `IconLink` here and a different
 * hand-rolled `<nav>` plus Base UI `Tooltip` there is one component with a
 * magnet. Nothing about this zone's no-script promise changed — the shared file
 * is held to it by `lib/chrome-source.test.ts`, which is stricter than the prose
 * that guarded it before.
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
      <Chrome magnet="top-left" label="Site">
        <ChromeLink href="/" label="Ariko">
          <ArikoIcon className="size-5 text-foreground" />
        </ChromeLink>
        <ChromeLink href="/" label="Directory">
          <SproutIcon className="size-4" />
        </ChromeLink>
        <ChromeLink href="/beanstalk" label="Beanstalk">
          <WaypointsIcon className="size-4" />
        </ChromeLink>
      </Chrome>

      {/* The language switch keeps its own anchors and its own aria-label — it
          is a link to `?lang=…`, not an icon, so it does not go through
          ChromeLink, and it is the one CONTENT cluster rather than an icon
          cluster. It wears the same plate as the rail: a solid pill beside a
          chrome that had vanished would read as a stray button rather than as
          the other half of the same furniture. `content` is what gives text its
          own radius and padding. */}
      <Chrome magnet="top-right" content>
        <LangSwitch lang={lang} />
      </Chrome>
    </>
  );
}
