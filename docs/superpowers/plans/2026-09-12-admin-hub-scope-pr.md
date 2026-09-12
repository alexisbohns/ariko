# PR body — the admin gets a subject

> Copy everything below the rule into the pull request description. Nothing in
> this file is posted automatically; the Lab Note is posted on merge by the
> pipeline, from the PR body, not from here.
>
> **Tailwind note:** `docs/` is scanned as source text, so a utility class
> spelled in a fence here would be minted into the stylesheet. There are none
> below. Do not add any.

---

The admin has had five sections and no subject. `/admin/garden` listed plants
and pods in one table, with a tier column to say which of the two kinds each
row was and a visibility column to say which of two states it was in — both
columns the table apologising for mixing lists that were never one list. And
the thing an author actually works on — a plant, with its pods, its beans, its
sprouts, its screens — had no surface that gathered it. To see a plant's
sprouts you went to the Vault and filtered. To see its screens you went to the
library and filtered. The filter was already there, in two places, spelled
`?plant=`; the admin has had the right idea for a while and never said it out
loud.

**One decision applied everywhere: the admin's subject is a plant, and the URL
always says which one.**

## What changed

**The front door.** `/admin` was the inbox. It is now a welcome page: a
greeting, the ⌘K autocomplete inline and auto-focused, and every plant in two
tables — Published and Private, each with its count, each the same component
rendered twice so they cannot drift. Name, role, status, narrative. No tier
column, because only plants are listed; no visibility column, because the two
tables *are* the visibility.

**The sections are one per tier, and each is named for its tier.** The inbox
moved to `/admin/inbox`. `/admin/vault` became `/admin/sprouts` — "Vault"
named none of Pod, Bean or Sprout; it named a page that happened to list the
last one. `/admin/pods` and `/admin/beans` are new (beans have never had an
index). `/admin/garden` is gone. Both retired addresses redirect, temporarily,
for bookmarks. The rail is Inbox · Pods · Beans · Sprouts · Screens ·
Beanstalk, keyed by a stable id rather than by an href, so an item whose
address is per-plant can still carry an icon.

**The scope.** A new cluster at the top-left of the chrome holds the Ariko mark
and a plant switcher. Pick a plant and it rides in `?plant=` — and in the path
on a plant's own page. `lib/admin-scope.ts` is the only reader of it and the
only builder of the hrefs that change it; `lib/plant-path.ts` spells the plant
address once, so the rail's resolver and the scope rule cannot disagree about
which plant a URL names. **Every row of the switcher is a plain anchor**:
picking a plant is a navigation, never a write, which is what keeps the URL a
description of the view and makes the control inert rather than destructive
with script off. Scoped, the rail gains Overview — the one item that cannot
aggregate, since the all-plants overview *is* the root — and drops Beanstalk,
which merges sprouts with pollen envelopes that have no plant and would answer
half its own question narrowed.

**The hub.** `/admin/plant/[slug]` keeps its header and its narrative and gains
four previews under them — Pods, Beans, Sprouts, Screens — each a heading with
a count, a few rows, and a link into that section already narrowed to the
plant. The previews render the sections' own table components with a row limit,
so a preview and its section cannot draw the same row two ways. What stays on
the right-hand rail is the exhibition alone: re-sequencing a strip is the one
thing a preview cannot do. The bean preview counts a plant's direct beans plus
every one of its pods', through one function that `/admin/beans` also calls, so
the two numbers agree by construction.

**Structure.** Everything routeable except `login` now lives under
`app/admin/(chrome)/`. A route group's name never reaches the URL, so no admin
address and no middleware matcher changed — see the privacy note below for why
it is a group rather than a conditional.

Nothing public changed. The route table is unmoved: `/plant/[slug]` at 269 B
and `/pod/[slug]` at 175 B on the same 102 kB shared baseline.

## A privacy leak found and fixed inside this branch

Partway through, the chrome layout started reading the garden to compose the
plant switcher's marks — slug, name, logo URL, visibility — and handing the
array to `AdminChrome`, which is a client component. The chrome withdrew on the
login page with an early `return null`, and its docblock claimed the login page
"pays for a read it discards".

It did not discard it. It published it. Props to a client component are
serialized into the RSC flight payload and inlined into the HTML **before** the
component is ever called, so `return null` suppresses the markup and nothing
else. `middleware.ts` lets `/admin/login` through unauthenticated, which made
an anonymous `GET /admin/login` return every plant — including the one marked
private — logo URLs and all, to anybody who ran `curl` on the front door.

Every check in the repo passed while that was true: `tsc` (a plain array is a
valid prop), `npm test` (nothing rendered the layout), `npm run build`
(ordinary, correct Next). And the page looked right. The only way to see it was
to read the bytes.

`9e258df` fixes it with structure rather than a conditional: the login page
sits outside `app/admin/(chrome)/`, so the read happens in a layout the
anonymous route never enters. `lib/admin-login-layout-source.test.ts` pins the
route tree and the import graph, not the rendered HTML — the property is about
which layouts wrap that page, and no render can observe it.

## Verification

```
npm test        # tests 1277 · pass 1229 · fail 0 · skipped 48
npx tsc --noEmit   # clean
npm run lint       # clean
npm run build      # compiled, 9/9 static pages, route table unchanged for public routes
```

Every source-rule test run by name and passing: `server-safe-source` (39),
`garden-cache-source` (9), `exhibition-panel-source` (2), `screen-sheet-source`
(7), `media-picker-mount` (6), `toc-mount` (2), `pwa-source` (5),
`brand-source` (7), `admin-table-source` (6), `admin-section-source` (2),
`admin-login-layout-source` (3), `plant-switcher-a11y` (4), `plant-hero-a11y`
(2).

Three new source-rule tests arrived with the slice: `admin-table-source` (the
six shared table files stay server components — five of them would not fail the
build if they became client ones), `admin-section-source` (the inbox hands the
capture overlay the *unfiltered* seed total; `/admin/beans` narrows through the
deep bean rollup), and `admin-login-layout-source` (above).

Anonymously, against a dev server: `/admin` 307s to `/admin/login`,
`/admin/garden` 307s to `/admin`, `/admin/vault` 307s to `/admin/sprouts`, and
the login page's bytes contain no plant slug, no logo URL and no visibility.

## What is **not** verified

**Nothing behind the session gate has been seen in a browser at any point in
this slice.** Every claim above about behaviour rests on tests, on types, on
the build, and on reading the source. Specifically unconfirmed:

- the welcome page's layout — the greeting, the inline autocomplete, and the
  two plant tables side by side or stacked;
- the plant switcher's popover — whether it opens where it should, whether the
  grouped list reads well, and how the trigger looks with and without a logo;
- the hub's four previews — the two-column grid, the counts beside the
  headings, and the `all n →` links landing where they say;
- the screens preview's thumbnail row;
- the scoped rail in the flesh — Overview appearing, Beanstalk stepping aside;
- every hover label on the new top-left cluster.

A walkthrough with a session is the remaining work: `/admin` → each section →
pick a plant → each section again → the hub → `/admin/login`.

**One known gap, written down rather than left to be discovered.** The hub's
screens count matches **any** plant parent, while `/admin/screens?plant=`
narrows on the **first** one. A screen parented to two plants would therefore
be counted on both hubs and listed under one, and its `all n →` would land on
fewer rows than the heading promised. No screen in the garden has two plant
parents today and the create form cannot make one; if that changes, the two
sides have to be made to agree, not papered over on one side. The comment at
the call site and the README both say so.

(The equivalent hazard for pods was found and closed inside the branch —
`79b2479`: `/admin/pods` narrows on any plant parent, the way the dataset
answers, so a pod's hub count and its section's rows agree.)

## Lab Note

```yaml
en:
  title: The admin knows which project you're working on
  summary: Pick a plant once and it follows you everywhere — the inbox, the sprouts, the screens all narrow to it. Its page is now a proper home, with everything inside it in one place.
fr:
  title: L'admin sait sur quel projet tu bosses
  summary: Choisis une plante une fois et elle te suit partout — la boîte de réception, les pousses, les écrans s'y réduisent. Sa page devient un vrai QG, avec tout ce qu'elle contient au même endroit.
suggested:
  molecule: ariko
  type: improvement
  tags: [changelog]
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
