/**
 * Cloudinary delivers a resized derivative from a URL segment, so a thumbnail
 * needs no optimizer, no next/image, and no images.remotePatterns — just string
 * manipulation on a URL Cloudinary already serves.
 *
 * Why it matters here: a MediaImage's stored `url` is Cloudinary's secure_url,
 * the untouched original. The Directory paints it at 40px, an entity card at
 * 128px tall, and the admin's media picker at 80px square, so without this a
 * page of covers downloads several megabytes to fill a few thousand pixels —
 * the ratio components/media.tsx accepted for a full-size image on a bean page
 * does not survive being reused for a list of squares. Every caller asks for 2x
 * the box it paints into, so the derivative stays sharp on a retina display.
 *
 * components/media.tsx is deliberately NOT a consumer: it renders a sprout's
 * media at full size on the bean page, where the original is exactly what
 * should be delivered. This function exists for the three places that shrink an
 * image into a fixed box, not for the one place that shows the image itself.
 *
 * Anything that is not a Cloudinary delivery URL is returned UNCHANGED, byte
 * for byte. `lib/inbox.ts` deliberately does not host-check a stored media URL
 * (spec §3), so a hotlinked image from anywhere is a legitimate stored value,
 * and rewriting one blindly would produce a broken link rather than a smaller
 * image — the safe failure mode here is "no optimization", never "no image".
 *
 * Zero imports: `URL` is a Web/Node global, not a dependency, and nothing else
 * in this file reaches into the rest of the repo — string in, string out.
 */
export function cloudinaryThumb(url: string, opts: { width: number; height: number }): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url; // not a URL at all — never throw on a malformed stored value
  }

  // Exact host match, not a suffix check: lib/storage.ts's toMediaImage stores
  // Cloudinary's own secure_url verbatim, and this app never configures a
  // custom (CNAMEd) delivery domain, so "res.cloudinary.com" is the only host
  // a genuine upload can produce.
  if (parsed.hostname !== "res.cloudinary.com") return url;

  // The literal delivery segment for an image asset served by upload. This
  // excludes other resource types (video/, raw/) and other delivery methods
  // (fetch/, private/, authenticated/) that MediaImage never stores today —
  // a transformation segment inserted the same way would not necessarily suit
  // those, and this function only knows how to shrink an image/upload URL.
  const marker = "/image/upload/";
  const markerIndex = parsed.pathname.indexOf(marker);
  if (markerIndex === -1) return url;

  const head = parsed.pathname.slice(0, markerIndex + marker.length);
  const tail = parsed.pathname.slice(markerIndex + marker.length);
  const firstSegment = tail.split("/", 1)[0] ?? "";

  // Idempotency: a stacked transform crops-and-scales an already-cropped-and-
  // scaled image, which is a DIFFERENT image, not a smaller one — so a segment
  // that already looks like a transformation is left exactly as it is rather
  // than getting a second one prepended, regardless of the width/height asked
  // for this time.
  //
  // A transformation segment is one or more comma-separated `key_value` groups
  // with a lowercase-letter key (w_80, h_80, c_fill, q_auto, f_auto, ...) — the
  // shape every Cloudinary transformation parameter takes. Cloudinary's own
  // version segment ("v" + digits, e.g. "v1234567890") is excluded explicitly,
  // since a freshly-uploaded secure_url always carries one immediately after
  // "upload/" (lib/storage.ts forwards it verbatim) and it must not be mistaken
  // for "already transformed". This app's own uploads never set an explicit
  // public_id (lib/storage.ts — Cloudinary mints one), so a folder or generated
  // public_id landing in this position without a version ahead of it is not a
  // realistic collision with the transform shape either.
  if (!isVersionSegment(firstSegment) && looksLikeTransform(firstSegment)) {
    return url;
  }

  const { width, height } = opts;
  const transform = `w_${width},h_${height},c_fill,q_auto,f_auto`;
  parsed.pathname = `${head}${transform}/${tail}`;
  return parsed.toString();
}

function isVersionSegment(segment: string): boolean {
  return /^v\d+$/.test(segment);
}

function looksLikeTransform(segment: string): boolean {
  return /^[a-z]+_[^,/]+(,[a-z]+_[^,/]+)*$/i.test(segment);
}
