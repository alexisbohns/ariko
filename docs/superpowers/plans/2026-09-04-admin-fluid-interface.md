# Admin Fluid Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin's top bar with a floating icon rail, turn seed capture into a keystroke-opened full-screen overlay, and collapse the vault's filter rows into icon popovers.

**Architecture:** Chrome moves out of the pages and into `app/admin/layout.tsx` as one client component that derives its active item from `usePathname()` — the pure resolution lives in `lib/admin-nav.ts` and is the only unit-tested piece. Seed capture becomes a client island (`seed-overlay.tsx`) posting to the unchanged `createSeedAction`; the vault's filter links move inside popovers without touching any server-side filtering. Spec: `docs/superpowers/specs/2026-09-04-admin-fluid-interface-design.md`.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, Tailwind v4, shadcn on Base UI, lucide icons, `@tanstack/react-hotkeys`, `node --test` for pure-logic tests.

---

## File Structure

**Created:**
- `lib/admin-nav.ts` — the nav model (`NAV_ITEMS`) and `resolveNavItem(pathname)`. Pure, no JSX, no React. Lives in `lib/` because that is where `npm test` looks.
- `lib/admin-nav.test.ts` — tests for `resolveNavItem`.
- `app/admin/_components/admin-chrome.tsx` — client. The left rail + top-right actions. Imports the model from `lib/admin-nav.ts` and maps icons by href.
- `app/admin/_components/seed-overlay.tsx` — client. The `+` trigger, the `k`/`Escape` hotkeys, and the overlay form.
- `app/admin/_components/vault-filters.tsx` — client. Three popover triggers wrapping filter links.

**Modified:**
- `app/admin/layout.tsx` — renders `<AdminChrome />`, widens the content padding.
- `app/admin/page.tsx` — Seed card removed, title line + `<SeedOverlay />`.
- `app/admin/vault/page.tsx` — `filterRow` replaced by `<VaultFilters />`.
- `components/admin/media-picker.tsx` — new `compact` prop.
- Eight pages drop their `<AdminBar …/>` line and its import: `app/admin/page.tsx`, `app/admin/vault/page.tsx`, `app/admin/garden/page.tsx`, `app/admin/beanstalk/page.tsx`, `app/admin/pod/[slug]/page.tsx`, `app/admin/plant/[slug]/page.tsx`, `app/admin/sprout/[slug]/page.tsx`, `app/admin/bean/[id]/page.tsx` (two call sites), `app/admin/triage/[id]/page.tsx`.
- `CLAUDE.md` — the third client-JS exception.

**Deleted:**
- `app/admin/_components/admin-bar.tsx`

**Added by the shadcn CLI:**
- `components/ui/tooltip.tsx`, `components/ui/popover.tsx`

---

## Task 1: Dependencies and primitives

**Files:**
- Modify: `package.json` (by the package managers, not by hand)
- Create: `components/ui/tooltip.tsx`, `components/ui/popover.tsx` (by the shadcn CLI)

- [ ] **Step 1: Install the hotkeys library**

```bash
npm install @tanstack/react-hotkeys
```

`@tanstack/hotkeys` is its dependency and arrives with it — do not install it separately.

- [ ] **Step 2: Add the two Base UI primitives**

```bash
npx shadcn@latest add tooltip popover
```

`CLAUDE.md` forbids hand-rolling a primitive the registry has. Answer any overwrite prompt with "no" — neither file exists today, so no prompt is expected.

- [ ] **Step 3: Verify both landed and the tree still builds**

```bash
ls components/ui/tooltip.tsx components/ui/popover.tsx && npx tsc --noEmit
```

Expected: both paths listed, `tsc` exits 0 with no output.

- [ ] **Step 4: Note the exported names**

Read the two new files and write down what they export (e.g. `Tooltip`, `TooltipTrigger`, `TooltipContent` / `Popover`, `PopoverTrigger`, `PopoverContent`, and possibly a `TooltipProvider` or `PopoverPositioner`). Base UI's shadcn style sometimes wraps content in a positioner. **Later tasks in this plan assume the plain `Tooltip`/`TooltipTrigger`/`TooltipContent` and `Popover`/`PopoverTrigger`/`PopoverContent` shape** — if the generated files differ, adapt the JSX in Tasks 4, 6 and 7 to the real API rather than inventing components.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json components/ui/tooltip.tsx components/ui/popover.tsx
git commit -m "Add TanStack hotkeys, tooltip and popover primitives"
```

---

## Task 2: The nav model and active-item resolution

The rail has no `current` prop to lean on, so it infers the section from the pathname. Prefix matching is the non-obvious part: `/admin` is a prefix of every admin URL, so it must match exactly, and the detail routes belong to sections whose names they do not share.

**Files:**
- Create: `lib/admin-nav.ts`
- Test: `lib/admin-nav.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/admin-nav.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, resolveNavItem } from "./admin-nav";

test("the four sections are the nav, in order", () => {
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.href),
    ["/admin", "/admin/vault", "/admin/garden", "/admin/beanstalk"],
  );
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.label),
    ["Inbox", "Vault", "Garden", "Beanstalk"],
  );
});

test("/admin matches Inbox exactly, not as a prefix of everything", () => {
  assert.equal(resolveNavItem("/admin"), "/admin");
  assert.equal(resolveNavItem("/admin/"), "/admin");
});

test("section roots resolve to themselves", () => {
  assert.equal(resolveNavItem("/admin/vault"), "/admin/vault");
  assert.equal(resolveNavItem("/admin/garden"), "/admin/garden");
  assert.equal(resolveNavItem("/admin/beanstalk"), "/admin/beanstalk");
});

test("detail routes resolve to the section they belong to", () => {
  assert.equal(resolveNavItem("/admin/sprout/my-sprout"), "/admin/vault");
  assert.equal(resolveNavItem("/admin/bean/abc123"), "/admin/vault");
  assert.equal(resolveNavItem("/admin/plant/ariko"), "/admin/garden");
  assert.equal(resolveNavItem("/admin/pod/some-pod"), "/admin/garden");
  assert.equal(resolveNavItem("/admin/triage/abc123"), "/admin");
});

test("login belongs to no section", () => {
  assert.equal(resolveNavItem("/admin/login"), null);
});

test("an unknown admin route highlights nothing", () => {
  assert.equal(resolveNavItem("/admin/nowhere"), null);
  assert.equal(resolveNavItem("/"), null);
});

test("a prefix must end at a segment boundary", () => {
  // /admin/vaulted is not the vault.
  assert.equal(resolveNavItem("/admin/vaulted"), null);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test 2>&1 | tail -20
```

Expected: failure resolving `./admin-nav` — "Cannot find module".

- [ ] **Step 3: Write the implementation**

Create `lib/admin-nav.ts`:

```ts
/**
 * The admin rail's model. Pure and JSX-free so `npm test` can reach it: the
 * rail itself is a client component, and icons are bound to these hrefs there.
 *
 * The floating rail dropped the `current` prop every page used to pass, so the
 * active item is inferred from the pathname instead. Two things make that
 * non-obvious, and both are why this function exists rather than an inline
 * `startsWith`:
 *
 *  - "/admin" is a prefix of every admin URL, so it can only ever match
 *    EXACTLY, or the Inbox icon would light on every page.
 *  - the detail routes do not share their section's name — a sprout and a bean
 *    belong to the Vault, a plant and a pod to the Garden, a triage to the
 *    Inbox.
 */

export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Inbox" },
  { href: "/admin/vault", label: "Vault" },
  { href: "/admin/garden", label: "Garden" },
  { href: "/admin/beanstalk", label: "Beanstalk" },
];

// [route prefix, the nav href it lights]. Order is irrelevant — no prefix here
// is a prefix of another.
const SECTIONS: ReadonlyArray<readonly [string, string]> = [
  ["/admin/vault", "/admin/vault"],
  ["/admin/sprout", "/admin/vault"],
  ["/admin/bean", "/admin/vault"],
  ["/admin/garden", "/admin/garden"],
  ["/admin/plant", "/admin/garden"],
  ["/admin/pod", "/admin/garden"],
  ["/admin/beanstalk", "/admin/beanstalk"],
  ["/admin/triage", "/admin"],
];

/**
 * The href of the nav item a pathname belongs to, or null when it belongs to
 * none (the login page, and anything unrecognized — an unknown route lights
 * nothing rather than guessing).
 */
export function resolveNavItem(pathname: string): string | null {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (path === "/admin") return "/admin";
  for (const [prefix, href] of SECTIONS) {
    // The boundary check is what keeps "/admin/vaulted" out of the Vault.
    if (path === prefix || path.startsWith(`${prefix}/`)) return href;
  }
  return null;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
npm test 2>&1 | tail -20
```

Expected: all tests pass, including the pre-existing suite.

- [ ] **Step 5: Commit**

```bash
git add lib/admin-nav.ts lib/admin-nav.test.ts
git commit -m "Admin nav model: resolve the active section from the pathname"
```

---

## Task 3: The floating chrome

**Files:**
- Create: `app/admin/_components/admin-chrome.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Write the chrome component**

Create `app/admin/_components/admin-chrome.tsx`:

```tsx
"use client";

import { usePathname } from "next/navigation";
import { Archive, ExternalLink, Inbox, LogOut, Sprout, Waypoints } from "lucide-react";
import type { ComponentType } from "react";
import { NAV_ITEMS, resolveNavItem } from "@/lib/admin-nav";
import { logoutAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * The admin's chrome, rendered once by the layout rather than by each page —
 * which is why the `current` prop the old AdminBar took is gone: the active
 * item comes from the pathname (lib/admin-nav.ts).
 *
 * Chrome, not a form: every nav item is a plain <a href> and Log out is still
 * a real <form> with a real submit button, so the zero-client-JS rule in
 * CLAUDE.md is untouched here. (The seed overlay is where this slice spends
 * its exception.)
 */

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "/admin": Inbox,
  "/admin/vault": Archive,
  "/admin/garden": Sprout,
  "/admin/beanstalk": Waypoints,
};

export function AdminChrome() {
  const pathname = usePathname();

  // The login page lives under /admin but gets no chrome. Under the old bar
  // this was expressed by the page simply not calling it; the layout owns the
  // chrome now, so it is expressed here.
  if (pathname === "/admin/login") return null;

  const active = resolveNavItem(pathname);

  return (
    <>
      <nav
        aria-label="Admin sections"
        className="fixed left-4 top-1/2 z-40 -translate-y-1/2 rounded-2xl border bg-card/80 p-1.5 shadow-lg backdrop-blur"
      >
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.href];
            const isActive = item.href === active;
            return (
              <li key={item.href}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <a
                        href={item.href}
                        aria-label={item.label}
                        aria-current={isActive ? "page" : undefined}
                        className={
                          "flex size-9 items-center justify-center rounded-xl transition-colors " +
                          (isActive
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
                        }
                      >
                        <Icon className="size-4" />
                      </a>
                    }
                  />
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="fixed right-4 top-4 z-40 flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <a
                href="/"
                aria-label="Public site"
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              >
                <ExternalLink className="size-4" />
              </a>
            }
          />
          <TooltipContent side="bottom">Public site</TooltipContent>
        </Tooltip>

        <form action={logoutAction}>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button type="submit" size="icon" variant="ghost" aria-label="Log out">
                  <LogOut className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Log out</TooltipContent>
          </Tooltip>
        </form>
      </div>
    </>
  );
}
```

**On `render={…}`:** Base UI composes by passing the element to render rather than by `asChild`. If the generated `components/ui/tooltip.tsx` from Task 1 exposes a different composition API, use whatever that file actually supports — the requirement is that the nav items stay real `<a href>` elements and Log out stays a real submit button, not that this exact prop is used.

- [ ] **Step 2: Wire it into the layout**

Replace the whole of `app/admin/layout.tsx` with:

```tsx
import type { ReactNode } from "react";
import { AdminChrome } from "./_components/admin-chrome";

/**
 * The admin/tooling zone. It shares the design system with the public zone but
 * not its chrome: the floating rail and the top-right actions are rendered
 * here, once, and withdraw themselves on the login page.
 *
 * The padding clears the two fixed clusters — the rail on the left, the account
 * actions top-right — while keeping the centred max-width column.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminChrome />
      <main className="mx-auto max-w-5xl py-8 pl-20 pr-16">{children}</main>
    </>
  );
}
```

- [ ] **Step 3: Delete the old bar and every call site**

Delete the file:

```bash
git rm app/admin/_components/admin-bar.tsx
```

Then remove, from each of these files, both the `import { AdminBar } …` line and every `<AdminBar current="…" />` line:

- `app/admin/page.tsx` (1 call site)
- `app/admin/vault/page.tsx` (2 call sites — one in the load-failure early return)
- `app/admin/garden/page.tsx` (1)
- `app/admin/beanstalk/page.tsx` (1)
- `app/admin/pod/[slug]/page.tsx` (1)
- `app/admin/plant/[slug]/page.tsx` (1)
- `app/admin/sprout/[slug]/page.tsx` (1)
- `app/admin/bean/[id]/page.tsx` (2 call sites)
- `app/admin/triage/[id]/page.tsx` (1)

Nothing else in those files changes.

- [ ] **Step 4: Verify no reference survives and the tree compiles**

```bash
grep -rn "AdminBar" app/ components/ ; npx tsc --noEmit
```

Expected: the grep prints nothing (exit 1 is fine), `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add -A app/admin components/ui
git commit -m "Floating admin chrome replaces the top bar"
```

---

## Task 4: A compact mode for the media picker

The overlay's control row needs the picker to present as one small icon, not as a labelled file field with a bordered row list. Compact mode is a second *presentation* of the same island — the state machine, the upload path, the `__ready` marker and the settled-rows-only serialization are all untouched.

Compact mode deliberately drops the alt-text field and the reorder controls. A seed is an inbox item on its way to triage, and the sprout media card it lands on carries the full picker, so alt text is set where the image is actually published rather than at capture time.

**Files:**
- Modify: `components/admin/media-picker.tsx`

- [ ] **Step 1: Add the imports the compact branch needs**

In `components/admin/media-picker.tsx`, change the import block at the top to add `ImageIcon`, `buttonVariants` and `cn`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { Image as ImageIcon } from "lucide-react";
import type { Media } from "@/lib/data";
import { ALLOWED_TYPES, checkUploadFile } from "@/lib/upload-input";
import { cloudinaryThumb } from "@/lib/image-url";
import { cn } from "@/lib/utils";
import { uploadImageAction } from "@/app/admin/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
```

- [ ] **Step 2: Add the prop**

In the `MediaPicker` signature, add `compact = false` to the destructuring and this entry to the props type, after `max`:

```tsx
  /**
   * Render as a single icon trigger with inline thumbnails instead of the
   * labelled field + row list. For a control row that has no space for a
   * labelled file input — the seed overlay.
   *
   * A presentation, not a second component: same rows, same uploads, same
   * `__ready` marker, same settled-rows-only serialization. It drops the
   * alt-text field and the reorder controls, which is the honest cost — a seed
   * is on its way to triage, and the sprout media card downstream carries the
   * full picker.
   */
  compact?: boolean;
```

So the signature reads:

```tsx
export function MediaPicker({
  name,
  initial = [],
  links = false,
  max,
  submitLabel,
  compact = false,
}: {
```

- [ ] **Step 3: Add the compact render branch**

In `components/admin/media-picker.tsx`, immediately after the existing `const full = max !== undefined && rows.length >= max;` line and *before* the existing `return (` of the full layout, insert:

```tsx
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {/* The same marker the full layout emits, for the same reason: a list
            the admin emptied and a picker that never mounted must not look
            alike to the server. */}
        <input type="hidden" name={`${name}__ready`} value="1" />

        {rows.map((row, index) => (
          <span key={row.key} className="relative">
            {row.state === "settled" && row.media.kind === "image" ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={cloudinaryThumb(row.media.url, { width: 64, height: 64 })}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-8 rounded object-cover"
              />
            ) : row.state === "uploading" ? (
              <span className="flex size-8 animate-pulse items-center justify-center rounded bg-muted" />
            ) : row.state === "failed" ? (
              <span
                title={`${row.file.name}: ${row.error}`}
                className="flex size-8 items-center justify-center rounded bg-destructive/15 font-heading text-xs text-destructive"
              >
                !
              </span>
            ) : (
              <span className="flex size-8 items-center justify-center rounded bg-muted font-heading text-xs">
                ↗
              </span>
            )}
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label={`Remove item ${index + 1}`}
              onClick={() => remove(row.key)}
              className="absolute -right-1.5 -top-1.5 rounded-full bg-background shadow-sm"
            >
              ×
            </Button>
            {row.state === "settled" ? (
              <input type="hidden" name={name} value={JSON.stringify(row.media)} />
            ) : null}
          </span>
        ))}

        {full ? null : (
          <>
            {/* sr-only rather than hidden: a visually hidden input is still
                focusable and still labellable, so the icon below is a real
                <label> and the control keeps its keyboard path. */}
            <input
              id={`${name}-file`}
              ref={fileRef}
              type="file"
              accept={ALLOWED_TYPES.join(",")}
              multiple
              className="sr-only"
              onChange={(e) => addFiles(e.target.files)}
            />
            <label
              htmlFor={`${name}-file`}
              aria-label="Add an image"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "cursor-pointer text-muted-foreground",
              )}
            >
              <ImageIcon className="size-4" />
            </label>
          </>
        )}
      </div>
    );
  }

```

- [ ] **Step 4: Verify the tree still compiles and existing tests pass**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -10
```

Expected: `tsc` silent, all existing tests pass. `compact` is opt-in and defaults to `false`, so every current caller is unaffected.

- [ ] **Step 5: Commit**

```bash
git add components/admin/media-picker.tsx
git commit -m "Media picker: a compact icon presentation for the seed overlay"
```

---

## Task 5: The seed overlay

**Files:**
- Create: `app/admin/_components/seed-overlay.tsx`
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Write the overlay**

Create `app/admin/_components/seed-overlay.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Link2, Plus, Send, X } from "lucide-react";
import { createSeedAction } from "../actions";
import { MediaPicker } from "@/components/admin/media-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Seed capture — the THIRD deliberate client-JS exception in this codebase,
 * after the prose editor and the media picker, and unlike those two it is a
 * real loss rather than a contained one: without script there is no way to
 * capture a seed at all. Recorded as such in CLAUDE.md. An overlay that opens
 * on a keystroke, autofocuses and blurs the page behind it cannot exist without
 * script, and the alternative — a second server-rendered form at its own route,
 * writing the same seed — would be maintained by nobody.
 *
 * The exception is the SHELL, never the write path: this posts to
 * createSeedAction with the field names lib/seed-form.ts already reads
 * (`title`, `note`, `lang`, repeated `link`, `image` + `image__ready`).
 *
 * Native inputs styled to look like bare text, not contenteditable. The
 * rendered result is the same and the native ones keep accented input, undo,
 * `required` validation and autofocus for free, with nothing to sync.
 */

const FIELD =
  "w-full border-0 bg-transparent outline-none placeholder:text-muted-foreground/40 focus:outline-none";

export function SeedOverlay({ error }: { error?: string }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [firstLink, setFirstLink] = useState("");

  // A rejected save redirects to /admin?error=… — and the form it came from is
  // no longer on the page, so the banner would have nowhere to live. Reopen
  // onto it rather than bounce the author to a page that says nothing went
  // wrong. (Their text is gone either way; the message is what is salvageable.)
  useEffect(() => {
    if (error) setOpen(true);
  }, [error]);

  // The library's defaults are the ones this wants, and are relied on
  // deliberately: a bare single key defaults to ignoreInputs:true, so "k" does
  // not fire while the author is typing — including into this overlay's own
  // fields — while Escape defaults to ignoreInputs:false, so it closes from
  // inside the title input.
  useHotkey("k", () => setOpen(true), { enabled: !open });
  useHotkey("Escape", () => setOpen(false), { enabled: open });

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="New seed"
        title="New seed (k)"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New seed"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/70 p-6 backdrop-blur-xl"
          // Only a press that both starts and ends on the backdrop itself
          // dismisses — a drag that began inside the form and released outside
          // is a text selection, not a dismissal.
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Close"
            className="absolute right-4 top-4"
            onClick={() => setOpen(false)}
          >
            <X className="size-4" />
          </Button>

          <form action={createSeedAction} className="flex w-full max-w-xl flex-col gap-6">
            {error ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>Could not save: {error}</AlertDescription>
              </Alert>
            ) : null}

            <input type="hidden" name="lang" value={lang} />

            <input
              type="text"
              name="title"
              required
              autoFocus
              aria-label="Title"
              placeholder="What is it?"
              className={`${FIELD} text-center font-heading text-3xl tracking-tight`}
            />

            {/* field-sizing-content is Tailwind v4's `field-sizing: content` —
                the textarea grows with its text, with no JS measuring it. */}
            <textarea
              name="note"
              rows={2}
              aria-label="Note"
              placeholder="Say more…"
              className={`${FIELD} field-sizing-content resize-none text-center text-base`}
            />

            <div className="flex items-center gap-3 border-t pt-4">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Note language: ${lang === "en" ? "English" : "French"}`}
                onClick={() => setLang((l) => (l === "en" ? "fr" : "en"))}
              >
                <span className="text-base leading-none">{lang === "en" ? "🇬🇧" : "🇫🇷"}</span>
              </Button>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Link2 className="size-4 shrink-0 text-muted-foreground" />
                  <input
                    type="url"
                    name="link"
                    value={firstLink}
                    onChange={(e) => setFirstLink(e.target.value)}
                    aria-label="Link"
                    placeholder="paste a URL"
                    className={`${FIELD} min-w-0 flex-1 text-sm`}
                  />
                </div>
                {/* The second slot appears once the first is used. Both post
                    under `link`; buildSeedBody reads getAll("link") and drops
                    the blanks. */}
                {firstLink.trim() ? (
                  <div className="flex items-center gap-2">
                    <Link2 className="size-4 shrink-0 text-muted-foreground" />
                    <input
                      type="url"
                      name="link"
                      aria-label="Another link"
                      placeholder="another URL"
                      className={`${FIELD} min-w-0 flex-1 text-sm`}
                    />
                  </div>
                ) : null}
              </div>

              <MediaPicker name="image" compact />

              <Button type="submit" size="icon" aria-label="Add to inbox" className="rounded-full">
                <Send className="size-4" />
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
```

- [ ] **Step 2: Rewrite the inbox page's header**

In `app/admin/page.tsx`:

Replace the import block at the top with (the Seed card's imports go with the card — `createSeedAction`, `MediaPicker`, `Card…`, `Input`, `Label`, `Textarea`, `ChoiceLabel`/`NativeRadio` and `Button` are all now unused here; `Alert` stays for the load-failure line):

```tsx
import { type Seed, resolveText } from "@/lib/data";
import { listSeeds } from "@/lib/seeds";
import { SeedOverlay } from "./_components/seed-overlay";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
```

Then replace everything from `return (` to the end of the `<section>`'s opening — that is, the `<AdminBar …/>` line, the whole `<Card>…</Card>` Seed block, and the old `<h2>` — with this, keeping the table below it exactly as it is:

```tsx
  return (
    <article>
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-medium tracking-tight">
              Inbox{" "}
              {seeds ? <span className="text-muted-foreground">({seeds.length})</span> : null}
            </h1>
            <div className="ml-auto">
              <SeedOverlay error={error} />
            </div>
          </div>
          {seeds === null ? (
```

The rest of the file — the `seeds === null` / empty / `<Table>` branches and the closing tags — is unchanged, except that the `<section>` and `<div>` closing tags must still balance. The final structure is `<article>` › `<div className="flex flex-col gap-8">` › `<section>` › (title row, then the table branches).

**The `error` variable is already destructured** from `searchParams` at the top of the component — it now feeds `<SeedOverlay error={error} />` instead of an inline banner.

- [ ] **Step 3: Verify it compiles and builds**

```bash
npx tsc --noEmit && npm run build 2>&1 | tail -20
```

Expected: `tsc` silent; the build completes without errors. Unused-import errors here mean Step 2's import block was not applied — fix them by removing the import, not by re-adding the markup.

- [ ] **Step 4: Commit**

```bash
git add app/admin/_components/seed-overlay.tsx app/admin/page.tsx
git commit -m "Seed capture becomes a keystroke-opened overlay"
```

---

## Task 6: Vault filter popovers

**Files:**
- Create: `app/admin/_components/vault-filters.tsx`
- Modify: `app/admin/vault/page.tsx`

- [ ] **Step 1: Write the filter row**

Create `app/admin/_components/vault-filters.tsx`:

```tsx
"use client";

import { CircleDot, Sprout, Tag } from "lucide-react";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * The vault's three filter dimensions, collapsed into popovers.
 *
 * A container and nothing more: every option inside is the same <a href> the
 * page used to render inline, built by the page's own vaultHref, so filtering
 * stays server-side and a filter URL stays shareable. Client only because a
 * popover is.
 */

export interface FilterGroup {
  /** The dimension, used as the trigger's label. */
  key: "state" | "plant" | "tag";
  /** Every option, "all" first — already resolved by the page. */
  options: string[];
  /** The active option, or "all". */
  current: string;
  /** href for each option, in the same order as `options`. */
  hrefs: string[];
}

const ICONS: Record<FilterGroup["key"], ComponentType<{ className?: string }>> = {
  state: CircleDot,
  plant: Sprout,
  tag: Tag,
};

export function VaultFilters({ groups }: { groups: FilterGroup[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {groups.map((group) => {
        const Icon = ICONS[group.key];
        const filtered = group.current !== "all";
        return (
          <Popover key={group.key}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  variant={filtered ? "secondary" : "ghost"}
                  aria-label={`Filter by ${group.key}`}
                >
                  <Icon className="size-3.5" />
                  {filtered ? <span className="text-xs">{group.current}</span> : null}
                </Button>
              }
            />
            <PopoverContent align="start" className="w-48">
              <div className="flex flex-col gap-1">
                <span className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
                  {group.key}
                </span>
                {group.options.map((opt, i) => (
                  <a
                    key={opt}
                    href={group.hrefs[i]}
                    aria-current={opt === group.current ? "true" : undefined}
                    className="rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent"
                  >
                    {opt === group.current ? (
                      <Badge className="px-1.5 py-0">{opt}</Badge>
                    ) : (
                      opt
                    )}
                  </a>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
```

As in Task 3, if the generated `components/ui/popover.tsx` composes differently from `render={…}`, adapt — the requirement is that each option stays a real `<a href>`.

- [ ] **Step 2: Wire it into the vault page**

In `app/admin/vault/page.tsx`:

Add the import beside the others:

```tsx
import { VaultFilters, type FilterGroup } from "../_components/vault-filters";
```

Delete the whole `const filterRow = (label, key, options) => { … };` block. In its place, after `const tagOptions = ["all", ...distinctTags(all)];`, add:

```tsx
  // The hrefs are still built here, by vaultHref, so the popovers stay a
  // presentation of links this page already knew how to make.
  const groups: FilterGroup[] = (
    [
      ["state", STATE_OPTIONS],
      ["plant", plantOptions],
      ["tag", tagOptions],
    ] as const
  ).map(([key, options]) => ({
    key,
    options,
    current: active[key] ?? "all",
    hrefs: options.map((opt) => vaultHref(active, key, opt)),
  }));
```

Then replace the three-row block in the JSX:

```tsx
        <div className="flex flex-col gap-3">
          {filterRow("state", "state", STATE_OPTIONS)}
          {filterRow("plant", "plant", plantOptions)}
          {filterRow("tag", "tag", tagOptions)}
        </div>
```

with:

```tsx
        <VaultFilters groups={groups} />
```

The `Badge` import stays — the table's state column still uses it.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -5
```

Expected: `tsc` silent (a `STATE_OPTIONS` typed as `string[]` may need `as const` on the tuple — the snippet above already applies it), all tests pass. `lib/vault.test.ts` must still pass untouched: no filtering logic changed.

- [ ] **Step 4: Commit**

```bash
git add app/admin/_components/vault-filters.tsx app/admin/vault/page.tsx
git commit -m "Vault filters collapse into icon popovers"
```

---

## Task 7: Record the exception in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the third exception**

In `CLAUDE.md`, immediately after the media-picker bullet's final line ("Widening this to any *further* form is a decision, not a convenience.") and before the "Orientation lives in" paragraph, insert:

```markdown
- **Seed capture is the third**, and unlike the first two it is a real loss
  rather than a contained one (`app/admin/_components/seed-overlay.tsx`, the
  fluid-admin slice). The capture form left the inbox page: it is now a
  full-screen overlay opened by the `+` beside the page title or by the `k`
  key, with an autofocused title and no labels. **Without script there is no
  way to capture a seed** — the `+` and `k` both do nothing, and `/admin` is
  the inbox list alone.

  That was taken deliberately. An overlay that opens on a keystroke,
  autofocuses and blurs the page behind it cannot exist without script, and the
  only alternative — a second server-rendered form at its own route, writing
  the same seed — would be maintained by nobody and exercised by no one.
  Nothing is destroyed and nothing is silently mis-saved: the overlay simply is
  not there.

  The exception is the **shell**, never the write path. The overlay posts to
  the same `createSeedAction` with the same field names `lib/seed-form.ts`
  already reads, and the media picker inside it is the same island under its
  `compact` presentation — same `__ready` marker, same settled-rows-only
  serialization.

  Every *other* admin metadata form is unchanged and still zero-client-JS. The
  admin's chrome (`app/admin/_components/admin-chrome.tsx`) is a client
  component so it can read the pathname, but it is chrome, not a form: its nav
  items are plain `<a href>` and Log out is still a real `<form>` with a real
  submit button.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "CLAUDE.md: record seed capture as the third client-JS exception"
```

---

## Task 8: Verify the whole thing runs

**Files:** none — this task only runs and looks.

- [ ] **Step 1: Full check**

```bash
npm test 2>&1 | tail -10 && npx tsc --noEmit && npm run build 2>&1 | tail -20
```

Expected: tests pass, `tsc` silent, build succeeds.

- [ ] **Step 2: Run the admin and walk it**

```bash
npm run dev
```

Then check, at `http://localhost:3000/admin` (log in first if needed):

- The rail floats at the left edge, vertically centred; hovering an icon shows its label to the right; the Inbox icon is the filled one.
- Top-right shows two icon buttons; the first opens the public site, the second logs out.
- `/admin/login` (log out to reach it) shows **no** chrome at all.
- Visit `/admin/vault`, `/admin/garden`, `/admin/beanstalk` — the matching icon lights each time. Open a sprout and a bean: Vault stays lit. Open a plant and a pod: Garden. Open a triage: Inbox.
- On `/admin`, the Seed card is gone; the title line reads `Inbox (n)` with a `+` on the right.
- Press `k` — the overlay opens, the title field has focus. Press `Escape` — it closes. Click `+` — it opens. Click the backdrop — it closes.
- Type a title into the overlay and press `k`: the letter goes into the field, no second overlay, nothing swallowed.
- Fill a title, a note, toggle the flag to 🇫🇷, paste a URL (a second link slot appears), attach an image via the small image icon (a thumbnail appears inline), and send. The seed lands in the table below with the right note language and media count.
- Submit with an empty title: the browser's own `required` validation stops it.
- On `/admin/vault`, each of the three filter icons opens a popover; picking an option navigates, filters the table, shows the value beside the trigger icon, and survives a reload.

- [ ] **Step 3: Commit anything the walk-through fixed**

If nothing needed fixing, there is nothing to commit — say so rather than making an empty commit.

---

## Notes for the implementer

- **Do not touch** `createSeedAction`, `lib/seed-form.ts`, `lib/vault.ts`, or any other server logic. This slice is presentation; every server behaviour it relies on already exists and is already tested.
- **`npm test` only globs `lib/**` and `components/**`.** That is why `resolveNavItem` lives in `lib/admin-nav.ts` and not beside the component that uses it. Do not put a test under `app/` — it will never run.
- **The Base UI composition API is the one real unknown.** Task 1 Step 4 exists to settle it before Tasks 3, 6 depend on it. If `render={…}` is wrong for the generated files, adapt the JSX; the invariant is that nav items and filter options stay real `<a href>` elements and Log out stays a real submit button.
