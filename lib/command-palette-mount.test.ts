import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * THE SEARCH BUTTON IS IN THE SERVER HTML, and this file is the inverse of
 * `lib/toc-mount.test.ts` rather than a copy of it.
 *
 * That file pins a public-zone island rendering NOTHING until it mounts, which
 * is the public zone's rule. This one pins an admin island rendering its
 * trigger STRAIGHT AWAY, which is the admin's — and the two are not in tension:
 * the public zone is progressively enhanced, the admin is a JavaScript
 * application behind a session gate (CLAUDE.md §"Script, by zone").
 *
 * `CommandPalette` used to open with the mount gate's three lines:
 *
 *     const [mounted, setMounted] = useState(false);
 *     useEffect(() => setMounted(true), []);
 *     if (!mounted) return null;
 *
 * so the search icon was absent from the server HTML, absent through
 * hydration, and painted only when the effect flushed. On a screen recording of
 * the admin it was the icon visibly blinking in a few hundred milliseconds
 * after the chrome around it had settled, on every page — and because the rail
 * was a plain `<a href>` at the time, "every page" meant every click.
 *
 * The gate's argument was that the server render IS the script-off render and a
 * dead button should not be drawn. That argument belonged to the POC's
 * zero-client-JS rule and did not survive it.
 *
 * WHY THIS NEEDS A TEST RATHER THAN A COMMENT: re-adding the gate is a
 * three-line change that passes `tsc`, `eslint`, `npm test` and
 * `npm run build`, and it does not break a single behaviour — ⌘K still works,
 * the palette still opens, every row still navigates. It costs a flash on first
 * paint and nothing else, which is precisely the kind of regression nobody
 * notices in review and everybody notices in use.
 *
 * `renderToStaticMarkup` is the whole harness, as in
 * `lib/plant-switcher-a11y.test.ts`: a static render is exactly the server
 * render, so "is the trigger in the server HTML" is literally the question
 * being asked. No jsdom, and no router — which is also an assertion worth
 * making, since a `useRouter()` call above this boundary would throw here.
 */
async function renderChromeTrigger(): Promise<string> {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { CommandPalette } = await import("@/app/admin/_components/command-palette");
  return renderToStaticMarkup(React.createElement(CommandPalette) as never);
}

test("the palette's search trigger is server-rendered, not mounted in later", async () => {
  const html = await renderChromeTrigger();

  assert.notEqual(
    html.trim(),
    "",
    "CommandPalette rendered nothing on the server — the mount gate is back. " +
      "The admin is a JavaScript application; the trigger belongs in the HTML " +
      "so it paints with the rest of the chrome instead of blinking in after " +
      "hydration.",
  );

  assert.ok(
    /aria-label="Search"/.test(html),
    `the trigger must carry its accessible name in the server HTML — got: ${html}`,
  );
});

/**
 * The trigger is a BUTTON and not a link, which is what makes drawing it before
 * hydration honest: it opens a dialog in place rather than promising a
 * destination it cannot reach without script.
 */
test("the trigger is a button — it opens a surface, it does not navigate", async () => {
  const html = await renderChromeTrigger();
  assert.ok(/<button[^>]*aria-label="Search"/.test(html), html);
  assert.ok(!/<a[^>]*aria-label="Search"/.test(html), html);
});

/**
 * The palette itself stays closed and unmounted in that HTML — the island is
 * still an island. Removing the gate exposed the TRIGGER, not the index: the
 * rows are fetched when the dialog opens, and a server render that shipped them
 * would put every plant, pod, bean, sprout and seed into the flight payload of
 * every admin page, which is the `app/admin/(chrome)/layout.tsx` leak in a new
 * costume.
 */
test("opening is still what loads the palette — the closed trigger ships no rows", async () => {
  const html = await renderChromeTrigger();
  assert.ok(
    !/role="listbox"|AutocompleteList|data-slot="autocomplete/.test(html),
    `the closed palette must ship no list — got: ${html}`,
  );
});
