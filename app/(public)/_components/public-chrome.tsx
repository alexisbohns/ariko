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

/**
 * Ghost on desktop: the icons are the chrome, and the container that holds
 * them only exists while you are pointing at it.
 *
 * Three things about this are deliberate.
 *
 * **`border-transparent`, never `border-0`.** The border stays in the box model
 * and only loses its colour. Removing it would resize the cluster by 1px on
 * every hover, so the icons would twitch under the pointer that was reaching
 * for them — the one place a hover effect must not move anything.
 *
 * **`focus-within` mirrors every `hover`.** A keyboard user tabbing into the
 * chrome gets the same panel a pointer does; without it the focus ring would
 * sit on an invisible cluster floating over the page.
 *
 * **`md:` and up only.** Below that the plate stays on permanently, and that is
 * not a hedge about small screens — it is that touch has no hover at all. A
 * ghost chrome on a phone is a chrome that can never materialize, and it is
 * exactly where it needs the plate most: the clusters sit over the reading
 * column rather than beside it, so bare icons would be laid on top of the text
 * they overlap.
 */
const GHOST =
  "border bg-card/80 shadow-lg backdrop-blur " +
  "transition-[background-color,border-color,box-shadow] duration-200 " +
  "md:border-transparent md:bg-transparent md:shadow-none md:backdrop-blur-none " +
  "md:hover:border-border md:hover:bg-card/80 md:hover:shadow-lg md:hover:backdrop-blur " +
  "md:focus-within:border-border md:focus-within:bg-card/80 md:focus-within:shadow-lg " +
  "md:focus-within:backdrop-blur";

export function PublicChrome({ lang }: { lang: Lang }) {
  return (
    <>
      <nav
        aria-label="Site"
        className={`fixed left-4 top-4 z-40 flex items-center gap-1 rounded-2xl p-1.5 ${GHOST}`}
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
          IconLink. It wears the same ghost plate as the rail: a solid pill
          beside a chrome that had vanished would read as a stray button rather
          than as the other half of the same furniture. */}
      <div className={`fixed right-4 top-4 z-40 rounded-xl px-3 py-2 ${GHOST}`}>
        <LangSwitch lang={lang} />
      </div>
    </>
  );
}
