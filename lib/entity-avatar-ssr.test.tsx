import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { EntityAvatar } from "@/components/admin/glyphs";

/**
 * THE MARK'S `<img>` IS IN THE SERVER HTML.
 *
 * This is the last of the three flashes the admin's chrome used to show on
 * arrival, and the only one a soft navigation did not make unreachable: the
 * other two were downstream of the document being rebuilt (see
 * `lib/admin-soft-nav.test.ts`), but this one fires on any FIRST paint —
 * a hard refresh, a new tab, the first load of a session.
 *
 * `AvatarMark` used to be `components/ui/avatar.tsx`, the registry's Base UI
 * composite. That primitive holds its loading state in client state and only
 * reaches for the network from a layout effect:
 *
 *     const [loadingStatus, setLoadingStatus] = React.useState('idle');
 *     useIsoLayoutEffect(() => { const image = new window.Image(); … });
 *
 * and renders the element with `enabled: mounted`, where `mounted` begins
 * false. So the `<img>` was never in the server HTML at all — the preload
 * scanner could not see it, the request could not START until the bundle had
 * downloaded and hydrated, and the monogram was what you looked at until it
 * finished. On the chrome's plant switcher that was the logo visibly blinking
 * back to `OX` on every arrival.
 *
 * WHY A TEST RATHER THAN THE DOCBLOCK: reaching back for `<Avatar>` is the
 * natural thing to do. It is the registry primitive, CLAUDE.md tells you to
 * prefer the registry over hand-rolling, the import is one line, and the result
 * LOOKS IDENTICAL once loaded. `tsc`, `eslint`, `npm test` and `npm run build`
 * would all pass; the only symptom is a flash on first paint, which no
 * automated check notices and every human does.
 *
 * A static render IS the server render, so asking "is the img in this string"
 * is literally the question. `lib/plant-switcher-a11y.test.ts` set the idiom.
 */

const WITH_LOGO = {
  name: "Oxymore",
  logoUrl: "https://res.cloudinary.com/demo/image/upload/v1/oxymore.png",
};

test("a mark with a logo renders a real <img> on the server", () => {
  const html = renderToStaticMarkup(<EntityAvatar mark={WITH_LOGO} />);

  assert.ok(
    /<img\b/.test(html),
    "the mark rendered no <img> on the server — the logo cannot begin loading " +
      "until hydration, so it flashes its monogram on every first paint. " +
      `Got: ${html}`,
  );
  assert.ok(
    /res\.cloudinary\.com/.test(html),
    `the <img> must carry the stored logo's URL. Got: ${html}`,
  );
});

/**
 * A mark draws EITHER a monogram OR a logo. The initials used to be painted
 * underneath as a scriptless 404 fallback, and a transparent PNG is what that
 * cost: CSS cannot tell "not arrived yet" from "see-through", so every logo
 * with a hole in it showed initials and a grey plate through the hole. The
 * branch is on the server, where the answer is already known.
 */
test("a logo replaces the monogram rather than covering it", () => {
  const html = renderToStaticMarkup(<EntityAvatar mark={WITH_LOGO} />);
  assert.ok(
    !html.includes("OX"),
    `initials behind a logo show through its transparency. Got: ${html}`,
  );
});

/**
 * And no plate behind it either — a background colour fills a transparent PNG's
 * holes just as visibly as the initials did.
 */
test("a logo sits on no background of its own", () => {
  const html = renderToStaticMarkup(<EntityAvatar mark={WITH_LOGO} />);
  assert.ok(!/bg-muted/.test(html), `a logo must not carry a backfill. Got: ${html}`);
  const bare = renderToStaticMarkup(<EntityAvatar mark={{ name: "Paulopus" }} />);
  assert.ok(/bg-muted/.test(bare), `a monogram still gets its plate. Got: ${bare}`);
});

/**
 * `alt=""` is load-bearing twice over: it marks the image decorative (the name
 * is rendered right beside it, and `EntityAvatar` is `aria-hidden` anyway), AND
 * it is what makes a broken image collapse to nothing instead of drawing a
 * torn-page icon over the monogram. An `alt` with words in it would put a
 * filename on screen the moment a logo 404'd.
 */
test('the image is decorative — alt="" is what makes a 404 fall back cleanly', () => {
  const html = renderToStaticMarkup(<EntityAvatar mark={WITH_LOGO} />);
  assert.ok(/<img[^>]*alt=""/.test(html), `the <img> must carry alt="". Got: ${html}`);
});

/**
 * The square is reserved before the bytes land. Without it a table of marks
 * re-flows as each one resolves, which is the layout-shift version of the same
 * bug.
 */
test("the box is reserved, so rows do not shift as marks resolve", () => {
  const html = renderToStaticMarkup(<EntityAvatar mark={WITH_LOGO} />);
  assert.ok(/<img[^>]*width="24"/.test(html), html);
  assert.ok(/<img[^>]*height="24"/.test(html), html);
});

test("a mark with no logo renders the monogram and no <img> at all", () => {
  const html = renderToStaticMarkup(<EntityAvatar mark={{ name: "Paulopus" }} />);
  assert.ok(!/<img\b/.test(html), `no logo means no <img> to break. Got: ${html}`);
  assert.ok(html.includes("PA"), html);
});
