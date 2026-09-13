"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Globe, Lock, MessageSquareQuote, Tags } from "lucide-react";
import type { Visibility } from "@/lib/data";
import { visibilityLabel } from "@/lib/glyphs";
import { PLANT_VISIBILITIES } from "@/lib/plant-visibility";
import { setBeanVisibilityAction, editBeanKeywordAction, editBeanTagsAction } from "../actions";
import { OverlaySheet } from "./overlay-sheet";
import { PlantHeader } from "@/components/plant-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChoiceLabel, NativeRadio } from "@/components/ui/native-controls";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A bean's head: the name, the one-line description, and the three things a bean
 * IS beyond its prose — a visibility, a cover word, a tag list — as three icons
 * under it.
 *
 * `sprout-hero.tsx`'s shape, on the entity one tier up, and deliberately beat for
 * beat: an author moving between a bean and its sprouts should find the same
 * gestures. The layout is the SAME FILE (`components/plant-header.tsx`).
 *
 * **MARKLESS, and that is a decision rather than an omission.** A bean HAS a
 * cover — but a cover is portrait phone art or a landscape screenshot, and a
 * squircle crop of it is a picture of neither. `plant-header.tsx`'s prop comment
 * draws the line: absent is a statement about the entity, never a mark that
 * failed to load. The cover keeps a full-width panel on the rail, where its real
 * aspect survives.
 *
 * The shell is the exception, never the write path. `metaForm` is server-rendered
 * by the page and handed down, so this file never composes a payload for it; the
 * three it renders itself are real `<form>`s posting one field each.
 *
 * `readOnly` is the projected-bean gate's rendered half. A projected bean is
 * rebuilt from its feed, so every trigger here would offer an edit the next sync
 * discards — and `lib/pollen-store.ts`'s `deleteFeedData` takes the whole
 * document on a full rebuild. The three actions re-check it server-side, because
 * a rendered gate is not a guarantee.
 */

export interface BeanHeroProps {
  slug: string;
  /** Already resolved by the page. This file imports no value from @/lib/data. */
  name: string;
  description: string;
  visibility: Visibility;
  /** The stored keyword, both halves, via STRICT textPart on the page. */
  keywordEn: string;
  keywordFr: string;
  tags: string[];
  /**
   * Whether the stored cover is phone-shaped. Derived by the page from
   * `lib/bean-cover.ts` — the island learns the rule's RESULT, never the rule.
   * The keyword is drawn ONLY on the phone treatment, so a word typed under a
   * landscape screenshot is a silent no-op and the popover says so.
   */
  keywordDrawn: boolean;
  /** Source-owned and rebuildable: every trigger becomes a plain fact. */
  readOnly?: boolean;
  /** A rejected save's message, and which surface it came from. */
  error?: string;
  errorForm?: Surface;
  /**
   * The server-rendered meta form. A prop rather than an import: it is a server
   * component reaching a server action, and passing it down is what keeps this
   * file free of every field name on the bean.
   */
  metaForm: ReactNode;
  /**
   * A fingerprint of everything this head can write, computed by the page from
   * the STORED bean. A successful save redirects to this same route — a soft
   * navigation, so this component keeps its place in the tree and nothing resets
   * itself. The re-render carrying a different fingerprint is the only honest
   * signal that the write landed, so it is what closes the surface. A save that
   * changed nothing leaves it open, which is the truth.
   */
  saved: string;
}

/** The surfaces this head can open, one at a time — tracked in one place rather
 *  than in four independently uncontrolled primitives. */
export type Surface = "meta" | "visibility" | "keyword" | "tags";

export function BeanHero({
  slug,
  name,
  description,
  visibility,
  keywordEn,
  keywordFr,
  tags,
  keywordDrawn,
  readOnly = false,
  error,
  errorForm,
  metaForm,
  saved,
}: BeanHeroProps) {
  const [open, setOpen] = useState<Surface | null>(null);
  const [seenSaved, setSeenSaved] = useState(saved);

  // Controlled, so the primitive cannot infer where focus came from: the sheet is
  // opened from the title and reopened by a rejected save.
  const titleRef = useRef<HTMLButtonElement>(null);

  // A rejected save redirects here with ?form=...&error=... and the field it
  // rejected is behind a closed surface, so the banner would have nowhere to
  // live. Reopen onto it rather than land the author on a page that says nothing
  // went wrong.
  useEffect(() => {
    if (error && errorForm) setOpen(errorForm);
  }, [error, errorForm]);

  // The save signal above.
  useEffect(() => {
    if (saved !== seenSaved) {
      setSeenSaved(saved);
      setOpen(null);
    }
  }, [saved, seenSaved]);

  // A rejected save leaves ?form= and ?error= in the URL and they outlive the
  // surface: close, reload, and the banner comes back about an edit that no
  // longer exists in any field. Dropped with replaceState rather than a router
  // push — this is tidying the URL, not a navigation, and a navigation here would
  // re-render the page under the closing surface.
  const close = (): void => {
    setOpen(null);
    if (typeof window === "undefined" || !window.location.search) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("error") && !url.searchParams.has("form")) return;
    url.searchParams.delete("error");
    url.searchParams.delete("form");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  };

  const surface = (next: Surface | null) => (next ? setOpen(next) : close());

  // Every trigger's accessible name states its STORED value, on the control
  // rather than on a visible span (the hover label is CSS). It is the only place
  // a reader learns what these fields currently ARE. lib/bean-hero-a11y.test.ts
  // pins it — replace one with a bare word and the page looks identical and stops
  // saying what it is.
  const labels = {
    visibility: `Visibility: ${visibilityLabel(visibility)}`,
    keyword: `Keyword: ${keywordEn || keywordFr || "none"}`,
    tags: `Tags: ${tags.join(", ") || "none"}`,
  };

  return (
    <TooltipProvider>
      <PlantHeader
        /* No mark. See the docblock, and components/plant-header.tsx's prop
           comment: absent is a statement about the entity. */
        title={
          readOnly ? (
            name
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    ref={titleRef}
                    type="button"
                    onClick={() => setOpen("meta")}
                    className="rounded-lg px-2 py-0.5 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {name}
                  </button>
                }
              />
              <TooltipContent side="bottom">Edit name and description</TooltipContent>
            </Tooltip>
          )
        }
        description={description}
        facts={
          readOnly ? (
            /* A projected bean states its facts as WORDS. An icon is a control,
               and there is nothing here to control. */
            <div className="flex flex-wrap items-center justify-center gap-3 font-heading text-xs text-muted-foreground">
              <span>{labels.visibility}</span>
              <span>{labels.keyword}</span>
              <span>{labels.tags}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              {/* Visibility. An ENUM, so it gets the full guard: radios plus a
                  Save disabled until the pick differs from what is stored. A
                  one-click flip is a mis-click away from publishing a bean, and
                  the undo is another mis-click on the same pixel. */}
              <FactPopover
                open={open === "visibility"}
                onOpenChange={(next) => surface(next ? "visibility" : null)}
                error={errorForm === "visibility" ? error : undefined}
                label={labels.visibility}
                icon={visibility === "public" ? Globe : Lock}
                tone={visibility === "private" ? "text-foreground" : undefined}
              >
                <VisibilityForm slug={slug} current={visibility} />
              </FactPopover>

              {/* Keyword and tags. NOT enums — there is no vocabulary to draw as
                  radios — so each is one field and a plain Save. What the author
                  typed is on screen, which is the confirmation the radios
                  otherwise have to manufacture.

                  Neither is handed an `error`, unlike the visibility trigger
                  above, and that is the absence of a rejection rather than an
                  unhandled one: a blank keyword is a cover with no word on it
                  and a blank tag list is an untagged bean, so both actions
                  CLEAR rather than throw and neither can redirect with
                  `?form=`. Wiring a message into a surface no message can reach
                  would read as a live rule while being unreachable. If either
                  field ever grows a validation, this is the line to change and
                  `Surface` already has the member for it. */}
              <FactPopover
                open={open === "keyword"}
                onOpenChange={(next) => surface(next ? "keyword" : null)}
                label={labels.keyword}
                icon={MessageSquareQuote}
              >
                <KeywordForm slug={slug} en={keywordEn} fr={keywordFr} drawn={keywordDrawn} />
              </FactPopover>

              <FactPopover
                open={open === "tags"}
                onOpenChange={(next) => surface(next ? "tags" : null)}
                label={labels.tags}
                icon={Tags}
              >
                <TagsForm slug={slug} tags={tags} />
              </FactPopover>
            </div>
          )
        }
      />

      <OverlaySheet
        open={open === "meta"}
        onOpenChange={(next) => surface(next ? "meta" : null)}
        label="Edit bean meta"
        finalFocus={titleRef}
      >
        <div className="flex w-full max-w-xl flex-col gap-6">
          <p className="text-center font-heading text-xs uppercase tracking-[0.15em] text-muted-foreground">
            {name}
          </p>
          {error && errorForm === "meta" ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {metaForm}
        </div>
      </OverlaySheet>
    </TooltipProvider>
  );
}

/**
 * One fact: an icon that opens its editor, and nothing else.
 *
 * `sprout-hero.tsx`'s `FactPopover`, and the same two properties. The icon is a
 * trigger and NOT a submit: the form lives inside the popover, which Base UI
 * unmounts on close, so an abandoned edit is discarded with nothing to reset by
 * hand. An abandoned edit is not a pending write.
 *
 * `aria-label` states the STORED value, on the control rather than on a visible
 * span, because the hover label is CSS.
 */
function FactPopover({
  open,
  onOpenChange,
  label,
  icon: Icon,
  tone,
  error,
  children,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone?: string;
  /**
   * A rejected save's message, when this is the surface it came from. It has to
   * render HERE, beside the field: the page suppresses its own banner exactly
   * when `?form=` names a surface, so without this the message is shown nowhere
   * at all and the author learns only that their click did nothing.
   */
  error?: string;
  children: ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button type="button" size="icon" variant="ghost" aria-label={label}>
                  <Icon className={`size-4 ${tone ?? "text-muted-foreground"}`} />
                </Button>
              }
            />
          }
        />
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      <PopoverContent side="bottom" align="center" className="w-72 text-left">
        {error ? (
          <Alert variant="destructive" role="alert" className="mb-3">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {children}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The visibility vocabulary, drawn as native radios.
 *
 * The words come from `lib/glyphs.ts` and the members from
 * `lib/plant-visibility.ts`, so a visibility reads the same on the admin tables
 * and on this head. The hints are the only new prose, and they exist because what
 * each member DOES is invisible from this page.
 *
 * Not the Base UI RadioGroup: that one submits through a script-populated hidden
 * input, and a real radio is what keeps this form a form.
 */
function VisibilityForm({ slug, current }: { slug: string; current: Visibility }) {
  const [picked, setPicked] = useState<Visibility>(current);

  return (
    <form action={setBeanVisibilityAction} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />

      <div className="flex flex-col gap-2">
        {PLANT_VISIBILITIES.map((option) => {
          const Icon = option === "public" ? Globe : Lock;
          const id = `bean-visibility-${option}`;
          return (
            <ChoiceLabel key={option} htmlFor={id} className="items-start gap-2.5">
              <NativeRadio
                id={id}
                name="visibility"
                value={option}
                checked={picked === option}
                onChange={() => setPicked(option)}
                className="mt-0.5"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-1.5">
                  <Icon className="size-3.5 text-muted-foreground" />
                  {visibilityLabel(option)}
                </span>
                <span className="text-xs leading-snug text-muted-foreground">
                  {VISIBILITY_HINTS[option]}
                </span>
              </span>
            </ChoiceLabel>
          );
        })}
      </div>

      <div className="flex justify-end">
        {/* Disabled until the pick differs from what is stored. Without it the
            Save is a formality — two clicks that mean what one click meant — and
            the confirmation this popover exists to add is gone. */}
        <Button type="submit" size="sm" disabled={picked === current}>
          Save
        </Button>
      </div>
    </form>
  );
}

const VISIBILITY_HINTS: Record<Visibility, string> = {
  public: "On the public site, with its own page — and its published sprouts with it.",
  private: "Off the public site, and its sprouts leave with it. Nothing above or below is changed.",
};

/**
 * The cover's word, both languages.
 *
 * Bilingual because the words are not language-neutral (Accuracy is Justesse),
 * and because everything else a bean can say already is.
 *
 * No disabled-until-changed guard, unlike `VisibilityForm`. That guard makes a
 * second click a confirmation of a choice the author might not have meant; here
 * the author has typed, and what they typed is on screen.
 */
function KeywordForm({
  slug,
  en,
  fr,
  drawn,
}: {
  slug: string;
  en: string;
  fr: string;
  drawn: boolean;
}) {
  return (
    <form action={editBeanKeywordAction} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="bean-keyword">Keyword</Label>
        <Input id="bean-keyword" type="text" name="keyword" defaultValue={en} />
        <Label htmlFor="bean-keyword-fr">Keyword (fr)</Label>
        <Input id="bean-keyword-fr" type="text" name="keywordFr" defaultValue={fr} />
        <p className="text-xs leading-snug text-muted-foreground">
          {drawn
            ? "The one word the cover wears. Blank clears it."
            : "This cover isn't phone-shaped, so the word won't be drawn — it shows only on a portrait cover. Saved either way."}
        </p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          Save
        </Button>
      </div>
    </form>
  );
}

/**
 * The tag list, as one comma-separated field.
 *
 * The parse is `lib/bean-tags.ts`'s, server-side, not this input's: the trim is
 * load-bearing (the garden's tag filters compare with `===` and do not trim) and
 * a rule told in two places is two places that drift. What this field owes the
 * author is only the round trip — what they see is what is stored, joined the
 * same way it will be split.
 */
function TagsForm({ slug, tags }: { slug: string; tags: string[] }) {
  return (
    <form action={editBeanTagsAction} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="bean-tags">Tags</Label>
        <Input id="bean-tags" type="text" name="tags" defaultValue={tags.join(", ")} />
        <p className="text-xs leading-snug text-muted-foreground">
          Comma-separated. Blank clears them. Case matters: Ariko and ariko are two tags.
        </p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          Save
        </Button>
      </div>
    </form>
  );
}
