import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";

/**
 * A pod's visibility is the sixth enum field under the rule in CLAUDE.md: an
 * icon opens the vocabulary as radios, and a Save commits it. The icon is not a
 * label, so the trigger's accessible name is the only place a reader learns
 * what the pod currently IS — `lib/bean-hero-a11y.test.ts`'s argument, for the
 * same control one tier up.
 *
 * The second test is a SOURCE check: the radios live inside a Base UI popover,
 * which is portalled and unmounted while closed, so a server render of the
 * closed trigger contains no form to inspect.
 */

async function render(element: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(element as any);
}

async function trigger(visibility: "public" | "private"): Promise<string> {
  const { PodVisibility } = await import("@/app/admin/_components/pod-visibility");
  return render(React.createElement(PodVisibility, { slug: "a-pod", visibility }));
}

test("the visibility trigger names the stored visibility", async () => {
  assert.match(await trigger("public"), /aria-label="Visibility: Public"/);
  assert.match(await trigger("private"), /aria-label="Visibility: Private"/);
});

test("the trigger opens a guarded form rather than flipping, and posts to the pod's own action", () => {
  // A one-click flip is a mis-click away from taking a pod — and every bean
  // inside it — off the public site. The guard is the shared VisibilityForm
  // (radios, and a Save disabled until the pick differs), and the action is
  // the pod's: posting the bean's action from here would write a bean slug
  // lookup against a pod slug and redirect to /admin/sprouts.
  const island = readFileSync(join(process.cwd(), "app/admin/_components/pod-visibility.tsx"), "utf8");
  assert.match(island, /from "\.\/visibility-form"/);
  assert.match(island, /action=\{setPodVisibilityAction\}/);

  const form = readFileSync(join(process.cwd(), "app/admin/_components/visibility-form.tsx"), "utf8");
  assert.match(form, /type="radio"|NativeRadio/);
  assert.match(form, /disabled=\{picked === current\}/);
});

test("the pod page hands the island its rejection and its editor half, and does not key it", () => {
  // Three silent losses, each passing tsc and npm test:
  // - no `error` reaching FactPopover: a rejected save reopens onto silence,
  //   because the page hides its banner precisely when ?form= names a surface;
  // - no `lang`: a save from the French half lands on the English editor;
  // - a `key` on the island: a landed save remounts the trigger, Base UI's
  //   return-focus target is detached, and focus falls to document.body.
  const page = readFileSync(join(process.cwd(), "app/admin/(chrome)/pod/[slug]/page.tsx"), "utf8");
  const call = page.slice(page.indexOf("<PodVisibility"), page.indexOf("/>", page.indexOf("<PodVisibility")));
  assert.match(call, /error=\{visibilityError\}/);
  assert.match(call, /lang=\{lang\}/);
  assert.ok(!/\bkey=/.test(call), "the island closes by state, never by remount");
  assert.match(page, /error && !visibilityError/, "the banner yields to the popover");

  const island = readFileSync(join(process.cwd(), "app/admin/_components/pod-visibility.tsx"), "utf8");
  assert.match(island, /error=\{error\}/);
  assert.match(island, /lang=\{lang\}/);
});

test("the pod action lands back on the editor half it was posted from", () => {
  const actions = readFileSync(join(process.cwd(), "app/admin/actions.ts"), "utf8");
  const start = actions.indexOf("export async function setPodVisibilityAction");
  const body = actions.slice(start, actions.indexOf("\n}\n", start));
  assert.match(body, /editLang\(formData\.get\("lang"\)\)/);
  assert.match(body, /redirect\(withEditLang\(back, lang\)\)/);
});
