import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DARK_CLASS,
  DEFAULT_THEME,
  MEDIA_DARK,
  THEMES,
  THEME_SCRIPT,
  THEME_STORAGE_KEY,
  parseTheme,
  resolvesDark,
} from "@/lib/theme";

/**
 * THEME_SCRIPT is a STRING. That is not an implementation detail — it is the
 * whole reason this file exists.
 *
 * It has to be a string because it runs in <head> before first paint, before
 * any bundle, in both zones; a component would be a boundary and would run too
 * late, which is a flash of the wrong theme on every cold load. But a string is
 * invisible to the compiler: rename THEME_STORAGE_KEY, drop a member of THEMES,
 * or change the class from `dark`, and `tsc`, `npm test` and `npm run build`
 * all pass while the theme silently stops persisting or stops applying. The
 * first person to notice is a visitor whose choice did not stick.
 *
 * So the agreement between the script and the vocabulary beside it is asserted
 * rather than assumed. This is the same class of check as
 * `lib/pwa-source.test.ts`'s count of the cache-write family, and for the same
 * reason.
 */

test("the script reads the key the module exports", () => {
  assert.ok(
    THEME_SCRIPT.includes(THEME_STORAGE_KEY),
    `THEME_SCRIPT must read ${THEME_STORAGE_KEY} — a renamed key strands every stored choice`,
  );
});

test("the script applies the class globals.css actually defines", () => {
  // app/globals.css:6 — `@custom-variant dark (&:is(.dark *))`. Any other
  // class name toggles nothing at all.
  assert.ok(/["']dark["']/.test(THEME_SCRIPT), THEME_SCRIPT);
});

test("every member of the vocabulary appears in the script", () => {
  // A fourth theme added to THEMES that the script cannot resolve would draw
  // as a menu row that silently does nothing.
  for (const theme of THEMES) {
    assert.ok(THEME_SCRIPT.includes(theme), `${theme} is unreachable from THEME_SCRIPT`);
  }
});

test("the script cannot throw — localStorage throws in Safari private mode", () => {
  // An uncaught throw in a blocking <head> script stops the parser. This is not
  // defensive habit; it is the documented behaviour of the API being called.
  assert.ok(/\btry\b/.test(THEME_SCRIPT) && /\bcatch\b/.test(THEME_SCRIPT), THEME_SCRIPT);
});

/**
 * Runs the string as the browser would, against stand-ins for the three globals
 * it touches. The parameters shadow the real names, so `new Function` compiles
 * it exactly as the <head> parser does — a string that does not PARSE throws
 * here, which none of the substring checks above could notice.
 */
function runThemeScript(
  script: string,
  { stored, prefersDark, storageThrows = false }: { stored: string | null; prefersDark: boolean; storageThrows?: boolean },
): boolean | undefined {
  let applied: boolean | undefined;
  const localStorage = {
    getItem(key: string) {
      if (storageThrows) throw new Error("SecurityError");
      return key === THEME_STORAGE_KEY ? stored : null;
    },
  };
  const matchMedia = (query: string) => ({ matches: query === MEDIA_DARK && prefersDark });
  const document = {
    documentElement: {
      classList: {
        toggle(name: string, force: boolean) {
          if (name === DARK_CLASS) applied = force;
        },
      },
    },
  };
  new Function("localStorage", "matchMedia", "document", script)(localStorage, matchMedia, document);
  return applied;
}

test("the script parses, and paints what resolvesDark says it should", () => {
  // Every stored value against both OS answers, plus an unrecognised value and
  // an empty store — each of which should follow the OS. `resolvesDark` is the
  // island's reading, so this checks the claim in lib/theme.ts that the two
  // agree.
  for (const stored of [...THEMES, null, "sepia"]) {
    for (const prefersDark of [false, true]) {
      assert.equal(
        runThemeScript(THEME_SCRIPT, { stored, prefersDark }),
        resolvesDark(parseTheme(stored), prefersDark),
        `stored=${stored} prefersDark=${prefersDark}`,
      );
    }
  }
});

test("the script swallows a throwing localStorage — Safari private mode", () => {
  assert.doesNotThrow(() => runThemeScript(THEME_SCRIPT, { stored: "dark", prefersDark: true, storageThrows: true }));
});

test("the script survives the production minifier byte for byte", async () => {
  // Issue #112. Every check above reads the SOURCE string, through tsx — and
  // the source was right while www.ariko.app served
  // `…||"systemvar d=…matchMedia("(prefers-color-scheme: dark)document…`, which
  // throws `Unexpected identifier 'dark'` in every visitor's <head>. SWC's
  // compressor constant-folds `+`-joined template literals whose `${}` are
  // module constants, and it DROPS the text after the left template's last
  // substitution when the next operand is another such template. `tsc`,
  // `npm test` and `npm run build` all passed; a dark-mode visitor got a light
  // first paint on every load until the preferences menu hydrated.
  //
  // So this runs lib/theme.ts through the minifier Next's production build
  // uses, with the options its MinifyPlugin passes
  // (next/dist/build/webpack/plugins/minify-webpack-plugin), and requires the
  // folded string to equal the one the tests above just executed. Types are
  // stripped first with `typescript` because the minifier parses JavaScript;
  // the stripping cannot fold anything, so the minifier is the only stage
  // under test.
  //
  // The module is handed over as the BUNDLE hands it, not as the file reads:
  // `export` taken off every declaration, and only THEME_SCRIPT exported. SWC
  // will not inline an exported binding, so fed `export const DEFAULT_THEME`
  // it folds nothing and this test passes against the broken string — which
  // is what the first draft of it did. Webpack's module concatenation turns
  // those exports into plain locals of the chunk, and in that shape this
  // reproduces the served string byte for byte.
  const { readFileSync } = await import("node:fs");
  const ts = (await import("typescript")).default;
  const { minify } = await import("next/dist/build/swc/index.js");
  const source = readFileSync(new URL("./theme.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const bundled = js.replace(/^export (?=const |let |var |function )/gm, "") + "\nexport { THEME_SCRIPT };\n";
  const { code } = await minify(bundled, {
    compress: { inline: 2 },
    mangle: true,
    module: "unknown",
    output: { comments: false },
  });
  const built = await import(`data:text/javascript,${encodeURIComponent(code)}`);
  assert.equal(built.THEME_SCRIPT, THEME_SCRIPT, `the minifier rewrote THEME_SCRIPT:\n${code}`);
});

test("the default is a member of the union", () => {
  assert.ok(THEMES.includes(DEFAULT_THEME));
});

test("the root layout suppresses the hydration warning the script causes", async () => {
  // THEME_SCRIPT mutates <html class> before React hydrates, so the server's
  // className and the client's disagree BY DESIGN. Without
  // suppressHydrationWarning on that element React logs a mismatch error on
  // every cold load in dev — noise that trains people to ignore real ones.
  //
  // Source text rather than a render: the attribute is a directive to React's
  // hydration pass and leaves no trace in renderToStaticMarkup's output, so
  // there is nothing to assert on a rendered tree. lib/server-safe-source.test.ts
  // makes the same argument for the same reason.
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const html = source.slice(source.indexOf("<html"), source.indexOf(">", source.indexOf("<html")));
  assert.ok(
    html.includes("suppressHydrationWarning"),
    "app/layout.tsx's <html> must suppress the mismatch THEME_SCRIPT deliberately creates",
  );
});
