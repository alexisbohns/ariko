import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "../middleware";

/**
 * The public language switch is a link to `?lang=…`, and the ONLY thing that
 * turns that into a cookie and redirects is middleware.ts's public branch —
 * which runs on the paths its `matcher` names and on no others. A public page
 * missing from the matcher still renders its bilingual prose, still draws the
 * switch, and the switch does nothing: the query string reaches the page, no
 * cookie is set, and the reader stays in whatever language they arrived in.
 * tsc, eslint, npm test and npm run build all pass. This branch shipped
 * `/sprout/[slug]` exactly that way, and the final review caught it.
 *
 * So the directories are discovered rather than listed: every public route
 * with a bracketed child (`plant/[slug]`, `bean/[id]`, …) must have a matcher
 * entry beginning `/<dir>/:`, and the next one added fails here until it does.
 * `config` is imported rather than parsed, as lib/admin-lang-middleware.test.ts
 * imports `middleware` — Next requires the matcher to be a literal anyway, so
 * the imported value is the one it reads.
 */

const PUBLIC_ROUTES = join(process.cwd(), "app", "(public)", "(chrome)");

function dynamicPublicDirs(): string[] {
  return readdirSync(PUBLIC_ROUTES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) =>
      readdirSync(join(PUBLIC_ROUTES, name), { withFileTypes: true }).some(
        (child) => child.isDirectory() && /^\[.+\]$/.test(child.name),
      ),
    );
}

test("the discovery finds the public dynamic routes (a vacuous pass is not a pass)", () => {
  const dirs = dynamicPublicDirs();
  for (const known of ["plant", "pod", "bean"]) assert.ok(dirs.includes(known), `expected ${known} among ${dirs.join(", ")}`);
  assert.ok(!dirs.includes("beanstalk"), "beanstalk has no bracketed child and is matched by its literal path");
});

test("every public dynamic route is in the middleware matcher, so its language switch is live", () => {
  const matcher: readonly string[] = config.matcher;
  for (const dir of dynamicPublicDirs()) {
    assert.ok(
      matcher.some((entry) => entry.startsWith(`/${dir}/:`)),
      `middleware.ts's matcher has no "/${dir}/:…" entry — ?lang= on /${dir}/… is never turned into a cookie`,
    );
  }
});
