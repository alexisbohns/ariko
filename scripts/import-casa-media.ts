/**
 * One-off: the CASA episodes' Instagram carousels, into Cloudinary and onto the
 * two sprouts.
 *
 * A script rather than a drag into the admin picker for one reason: ORDER. It
 * is a carousel, so slide 3 must be third, and multi-file drop order is not
 * guaranteed by any browser. Here the order is the filename order, sorted
 * numerically, and it is reproducible.
 *
 * Idempotent by slug: it writes the FULL media[] array, so a second run
 * replaces rather than appends. It does re-upload — Cloudinary mints a fresh
 * public_id every time (lib/storage.ts refuses to derive one from a filename,
 * because that silently overwrote assets a published sprout pointed at) — so
 * the previous run's assets are orphaned rather than replaced. Clean them out
 * of the Cloudinary console if you run this more than twice.
 *
 * Re-running `npm run migrate` afterwards cannot clobber the result: `media` is
 * not a garden.yml field, so it is not in that script's $set document.
 *
 *   npm run import:casa
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "../lib/db";
import { uploadImage } from "../lib/storage";
import { detectEmbed } from "../lib/embeds";
import { normalizeLinkUrl } from "../lib/platforms";
import type { Media } from "../lib/data";

interface Episode {
  slug: string;
  folder: string;
  /** Embeds that precede the gallery, in render order. */
  embeds: string[];
  /** One per image, in sorted filename order. Length is asserted below. */
  alts: string[];
}

const EPISODES: Episode[] = [
  {
    slug: "casa-dating-0",
    folder: "/Users/alexis/Podcast/01-dating/post",
    embeds: [
      "https://open.spotify.com/episode/4PkLhHEbiZTSXYCmJENwqT",
      // The post's own permalink. Episode 1 therefore shows its carousel twice
      // — Meta's iframe on top, our durable copies below. That was chosen
      // deliberately: the embed carries live counts, the copies survive the
      // post being deleted.
      "https://www.instagram.com/p/DVAxzXvDNkZ/",
    ],
    alts: [
      "CASA Podcast — DATING, épisode 1. Les quatre hôtes du podcast dessinés en illustration sur fond rouge.",
      "« Mon date est plus ronde que sur ses photos Tinder (celles de sa jumelle) » — Alex : tricher comme photoshop ?",
      "« J'utilise les apps pour la validation. » Soph : « 600 matchs Tinder, c'est beaucoup ? » Charlo : « Très peu… »",
      "« J'attends qu'il m'offre à graille, pas de l'eau du robinet. » Charlo : « Quelqu'un qui boit de l'eau ? Ça va loin. »",
      "Alex : « Qualité n°1 que les femmes déclarent chercher ? » Ananas : « Propre. » Charlo : « La barre est basse… »",
      "« Sur quoi t'écoutes CASA ? » Spotify, Apple Podcasts, Deezer — Alex : « Bah, on les a toutes. »",
    ],
  },
  {
    slug: "casa-tolerance-0",
    folder: "/Users/alexis/Podcast/02-couple",
    embeds: ["https://open.spotify.com/episode/6haxhA84s8YavAPdMyjn3J"],
    alts: [
      "CASA Podcast — COUPLE, épisode 2. Les quatre hôtes du podcast dessinés en illustration sur fond violet.",
      "« Ma copine écrit des romans érotiques mais ne veut pas me les lire. » Alex : « T'as le droit d'avoir un jardin secret. »",
      "Ananas : « Ce que l'autre te donne n'est pas un dû mais un cadeau. » Charlo : « C'est beau ce que tu dis. »",
      "« Elle a des posters de calamar vampirique et de requin lutin. » Soph : « J'ai trop envie de voir ! » Ananas : « De fou ! »",
      "Soph : « Chez nous y a de gros pokémons en origami dans le salon. » Ananas : « C'est pour ça qu'elle ne nous invite pas. »",
      "Ananas : « Les gars se disent : j'échoue si elle utilise un sextoy. » Soph : « Elle me remplace ! »",
      "Alex : « Regarder du porno, c'est tricher ? » Ananas : « Peu comparé au flirt, c'est pas une vraie personne. »",
      "« Sur quoi t'écoutes CASA ? » Spotify, Apple Podcasts, Deezer — Alex : « Bah, on les a toutes. »",
    ],
  },
];

// Numeric-aware, so "post-dating 10.jpg" would sort after 9 rather than after
// 1. Six and eight files today; the rule costs nothing and removes a trap.
const byName = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

const imagesIn = (folder: string): string[] =>
  readdirSync(folder).filter((f) => /\.jpe?g$/i.test(f)).sort(byName);

async function main() {
  const db = await getDb();

  for (const episode of EPISODES) {
    const files = imagesIn(episode.folder);
    if (files.length !== episode.alts.length) {
      throw new Error(
        `${episode.slug}: ${files.length} images in ${episode.folder} but ${episode.alts.length} alt strings. ` +
          `Alt text is positional — refusing to shift it onto the wrong slides.`,
      );
    }

    // Embeds first, in declared order, then the image run. mediaRuns groups the
    // adjacent images into one strip; the embeds keep their own rows.
    const media: Media[] = episode.embeds.map((url) => detectEmbed(normalizeLinkUrl(url)));

    for (const [i, file] of files.entries()) {
      const bytes = readFileSync(join(episode.folder, file));
      const image = await uploadImage(bytes, file);
      media.push({ ...image, alt: episode.alts[i] });
      console.log(`  ${file} → ${image.url}`);
    }

    await db.collection("sprouts").updateOne({ slug: episode.slug }, { $set: { media } });
    console.log(
      `wrote media[${media.length}] → sprout:${episode.slug} ` +
        `(${episode.embeds.length} embeds, ${files.length} images)\n`,
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
