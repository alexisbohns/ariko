import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import type { SproutGarden } from "@/lib/data";

/**
 * The About panel on the sprout page's rail (spec 2026-10-10 §3, admin): where
 * a sprout hangs, drawn as the derived plant's pods and beans as checkboxes.
 *
 * What is pinned is the OFFER, not the write — `lib/sprout-anchor.test.ts` pins
 * what `resolveAnchor` refuses. The offer matters on its own because the panel
 * states the sprout's current plant as a hidden field and lists only that
 * plant's containers: a panel that offered another plant's bean would draw a
 * checkbox the action then refuses, and a panel that lost the `plant` field
 * would let the same payload move the sprout between plants, which the spec
 * says is not a feature. A sprout whose plant cannot be derived gets no form at
 * all, because there is no honest list to offer it.
 *
 * No jsdom: it is a server component rendering native controls, so
 * renderToStaticMarkup is the whole of it.
 */

async function render(element: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(element as any);
}

const garden: SproutGarden = {
  plants: [
    { slug: "p1", name: "Plant One", natures: ["work"], role: { kind: "owner" }, description: "" },
    { slug: "p2", name: "Plant Two", natures: ["work"], role: { kind: "owner" }, description: "" },
  ],
  pods: [
    { slug: "pod1", name: "Pod One", description: "", parents: ["plant:p1"] },
    { slug: "pod2", name: "Pod Two", description: "", parents: ["plant:p2"] },
  ],
  beans: [
    { slug: "b-in-pod", name: "In Pod", parents: ["pod:pod1"] },
    { slug: "b-direct", name: "Direct", parents: ["plant:p1"] },
    { slug: "b-other", name: "Other", parents: ["pod:pod2"] },
  ],
};

async function form(sprout: Record<string, unknown>) {
  const { SproutAboutForm } = await import("@/app/admin/_components/sprout-about-form");
  return render(React.createElement(SproutAboutForm, { sprout, garden, lang: "en" } as any));
}

test("the panel offers the derived plant's pods and beans as checkboxes, checked where the sprout is about them", async () => {
  const html = await form({ slug: "s", about: ["bean:b-in-pod"] });
  assert.match(html, /name="plant" value="p1"/);
  assert.match(html, /name="about" value="pod:pod1"/);
  // React emits `value` after `checked` regardless of prop order, so the two
  // attributes are matched within one tag rather than in sequence.
  assert.match(html, /<input[^>]*name="about"[^>]*checked=""[^>]*value="bean:b-in-pod"/);
  assert.doesNotMatch(html, /<input[^>]*checked=""[^>]*value="pod:pod1"/);
  assert.match(html, /name="about" value="bean:b-direct"/);
  assert.doesNotMatch(html, /value="pod:pod2"/, "another plant's pod is not offered");
  assert.doesNotMatch(html, /value="bean:b-other"/, "another plant's bean is not offered");
  assert.match(html, /Plant One/, "the plant is shown, not edited");
  assert.match(html, /name="slug" value="s"/);
  assert.match(html, /name="lang" value="en"/);
});

test("a plant-level sprout checks nothing and still offers the plant's pods and beans", async () => {
  const html = await form({ slug: "s", parents: ["plant:p1"] });
  assert.match(html, /name="plant" value="p1"/);
  assert.match(html, /value="pod:pod1"/);
  assert.match(html, /value="bean:b-direct"/);
  // The attribute, not the word: the hint prose says "Nothing checked".
  assert.doesNotMatch(html, /checked=""/);
});

test("a sprout with no derivable plant draws no form — only the explanation", async () => {
  const html = await form({ slug: "s", about: ["bean:b-in-pod", "bean:b-other"] });
  assert.doesNotMatch(html, /<form/);
  assert.match(html, /p1, p2/, "names the plants it rolls up to");
  const dangling = await form({ slug: "s", about: ["bean:nope"] });
  assert.doesNotMatch(dangling, /<form/);
});

test("a bean under two of the plant's pods is offered once", async () => {
  // Two pods both own `b-shared`. Listing it under each would post the same
  // ref twice when both boxes are checked — harmless to `resolveAnchor`, which
  // dedupes, but two checkboxes for one fact is a form that can disagree with
  // itself (one checked, one not) about what the sprout is about.
  const twoPods: SproutGarden = {
    plants: garden.plants,
    pods: [
      { slug: "pod1", name: "Pod One", description: "", parents: ["plant:p1"] },
      { slug: "pod1b", name: "Pod One B", description: "", parents: ["plant:p1"] },
    ],
    beans: [{ slug: "b-shared", name: "Shared", parents: ["pod:pod1", "pod:pod1b"] }],
  };
  const { SproutAboutForm } = await import("@/app/admin/_components/sprout-about-form");
  const html = await render(
    React.createElement(SproutAboutForm, {
      sprout: { slug: "s", parents: ["plant:p1"] },
      garden: twoPods,
      lang: "en",
    } as any),
  );
  assert.equal(html.match(/value="bean:b-shared"/g)?.length, 1);
});
