import { ArikoIcon } from "@/components/brand/ariko-icon";
import { Chrome, ChromeLink } from "@/components/chrome";
import { PreferencesMenu } from "@/app/(public)/_components/preferences-menu";
import { SproutIcon, WaypointsIcon } from "@/components/public-icons";
import type { Lang } from "@/lib/locale";

/**
 * The public zone's chrome: two fixed clusters where a header bar used to be.
 *
 * A SERVER component, and its NAVIGATION half stays entirely one — the glyphs
 * are inline SVG (components/public-icons.tsx) because lucide is "use client",
 * and the hover labels are CSS (components/chrome.tsx) because the registry
 * Tooltip is too. A visitor with script off can still go everywhere.
 *
 * The preferences cluster is the exception, and it is declared rather than
 * incidental: `preferences-menu.tsx` is a client island, because a menu is a
 * client component in the registry and hand-rolling one to avoid that would
 * break the rule that matters more. What it costs — the language switch,
 * script-off — is written down in CLAUDE.md.
 *
 * The shell itself is no longer this file's: `Chrome` and `ChromeLink` are the
 * admin rail's shell as well, which is what the shared-surfaces slice was for.
 * What used to be a hand-rolled `<nav>` plus `IconLink` here and a different
 * hand-rolled `<nav>` plus Base UI `Tooltip` there is one component with a
 * magnet. That shared file is still held to the zone's no-script promise by
 * `lib/server-safe-source.test.ts` (which absorbed `chrome-source.test.ts`),
 * and it still is — the island above sits BESIDE `Chrome`, never inside it.
 *
 * The mark and "Directory" both point at `/`. That duplication is in the header
 * this replaces, and it is kept deliberately: the mark is the brand, the icon
 * is a nav item, and a nav whose first item is missing reads as broken.
 *
 * The two nav glyphs are the ADMIN RAIL'S OWN — sprout for the directory of
 * plants, waypoints for the beanstalk. Two zones, one vocabulary: a visitor who
 * becomes the author finds the same glyph meaning the same thing.
 */

export function PublicChrome({ lang, authed }: { lang: Lang; authed: boolean }) {
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

      {/* The preferences cluster: language, theme, and — for the author — the
          way back into the admin. It is an ORDINARY icon cluster now, not the
          `content` text variant the EN/FR pill needed, so both clusters in this
          zone finally have the same geometry as every cluster in the admin. The
          island inside is server-rendered, so this corner is never empty on a
          cold load. */}
      <Chrome magnet="top-right">
        <PreferencesMenu lang={lang} authed={authed} />
      </Chrome>
    </>
  );
}
