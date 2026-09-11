// lib/error-pages.test.tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import RootNotFound from "@/app/not-found";
import PublicError from "@/app/(public)/error";
import ChromeError from "@/app/(public)/(chrome)/error";
import { COPY as CHROME_NOT_FOUND_COPY, NotFoundCopy } from "@/app/(public)/(chrome)/not-found";

test("the root 404 offers a way back to the site", () => {
  const html = renderToStaticMarkup(<RootNotFound />);
  assert.match(html, /href="\/"/, "a 404 with no way out is a dead end");
});

/**
 * The chrome 404's default export is `async` and calls `currentLang()`,
 * which reads real request cookies via `next/headers` and throws outside a
 * request scope — so it can't be rendered in a plain node:test. The lookup —
 * `COPY[lang]` — is the part a regression could actually break (swapping
 * which key maps to which language), so that's what's tested directly.
 */
test("the chrome 404's fr entry is actually French", () => {
  assert.equal(CHROME_NOT_FOUND_COPY.fr.title, "Rien ici");
  assert.match(CHROME_NOT_FOUND_COPY.fr.body, /n'existe pas/);
  assert.notEqual(CHROME_NOT_FOUND_COPY.fr.home, CHROME_NOT_FOUND_COPY.en.home);
});

/**
 * The plausible regression: someone "fixes" this file by wrapping it in
 * `<main className={READING_COLUMN}>`, producing a nested `<main>` landmark
 * and a double-padded column. `(chrome)/layout.tsx` already renders both, so
 * this file must render neither. `NotFoundCopy` is the exported, synchronous
 * presentational half — rendered directly with an explicit `lang`, no cookies
 * involved.
 */
test("the chrome 404 renders no <main> and no max-w-3xl — its layout owns both", () => {
  const html = renderToStaticMarkup(<NotFoundCopy lang="fr" />);
  assert.doesNotMatch(html, /<main/, "the chrome layout already renders <main>");
  assert.doesNotMatch(html, /max-w-3xl/, "the chrome layout already renders the column");
  assert.match(html, /Rien ici/, "and it must actually be the French copy, not a silent default");
});

/**
 * The reset control is the only affordance an error page has. An error page
 * whose one control is broken is worse than Next's default, which at least
 * does not pretend. The digest is the only handle correlating a visitor's
 * report to a server log, so it must show up when Next supplies one.
 */
test("the public error boundary renders a working reset control and a digest", () => {
  let reset = 0;
  const html = renderToStaticMarkup(
    <PublicError
      error={Object.assign(new Error("boom"), { digest: "abc123" })}
      reset={() => {
        reset += 1;
      }}
    />,
  );
  assert.match(html, /<button/, "reset must be a real button");
  assert.match(html, /href="\/"/, "and there must still be a way home");
  assert.match(html, /abc123/, "the digest must be visible to quote in a report");
  assert.equal(reset, 0, "reset must not fire during render");
});

test("the public error boundary renders no dangling digest label when Next supplies none", () => {
  const html = renderToStaticMarkup(<PublicError error={new Error("boom")} reset={() => {}} />);
  assert.doesNotMatch(html, /Reference:/, "no digest, no label promising one");
});

/**
 * The inner boundary's shape matters the same way the chrome 404's does: it
 * renders inside `(chrome)/layout.tsx`'s own `<main>` and column, so it must
 * add neither.
 */
test("the chrome error boundary renders a working reset control, a digest, and no <main> or max-w-3xl", () => {
  let reset = 0;
  const html = renderToStaticMarkup(
    <ChromeError
      error={Object.assign(new Error("boom"), { digest: "xyz789" })}
      reset={() => {
        reset += 1;
      }}
    />,
  );
  assert.match(html, /<button/, "reset must be a real button");
  assert.match(html, /href="\/"/, "and there must still be a way home");
  assert.match(html, /xyz789/, "the digest surfaces here too");
  assert.doesNotMatch(html, /<main/, "the chrome layout already renders <main>");
  assert.doesNotMatch(html, /max-w-3xl/, "the chrome layout already renders the column");
  assert.equal(reset, 0, "reset must not fire during render");
});

/**
 * Parses `import ... from "specifier"` statements (the `"use client"` pragma
 * is not one). Non-greedy so a multi-line named-import block still resolves
 * to the one specifier it ends on.
 */
function importedModules(source: string): string[] {
  const re = /^import\s+(?:type\s+)?[\s\S]*?\sfrom\s+["']([^"']+)["'];?\s*$/gm;
  const modules: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) modules.push(match[1]);
  return modules;
}

/**
 * The error boundaries ship in the client bundle of every public route, in
 * the slice right after the rulebook rewrite took a client boundary OUT of
 * the public zone. An allowlist over the actual import statements is the real
 * invariant — a substring blocklist only catches names it thought to ban
 * (and its own docblock naming "lucide" was one hyphen from a false failure).
 */
test("the public error boundary imports only the measure, and nothing else", () => {
  const source = readFileSync(join(process.cwd(), "app/(public)/error.tsx"), "utf8");
  assert.deepEqual(importedModules(source), ["@/components/page-column"]);
});

test("the chrome error boundary imports nothing at all", () => {
  const source = readFileSync(join(process.cwd(), "app/(public)/(chrome)/error.tsx"), "utf8");
  assert.deepEqual(importedModules(source), []);
});

test("the public error boundary is a client component, as Next requires", () => {
  const source = readFileSync(join(process.cwd(), "app/(public)/error.tsx"), "utf8");
  assert.match(source, /^\s*["']use client["']/m);
});

test("the chrome error boundary is a client component, as Next requires", () => {
  const source = readFileSync(join(process.cwd(), "app/(public)/(chrome)/error.tsx"), "utf8");
  assert.match(source, /^\s*["']use client["']/m);
});
