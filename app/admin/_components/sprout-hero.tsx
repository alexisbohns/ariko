"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Calendar } from "lucide-react";
import type { SproutState } from "@/lib/data";
import type { Lang } from "@/lib/locale";
import { SPROUT_KIND_ICONS, SPROUT_STATE_ICONS } from "@/components/admin/glyphs";
import { sproutKindLabel, sproutStateLabel } from "@/lib/glyphs";
import { SPROUT_STATES } from "@/lib/sprout-state";
import { SPROUT_KINDS, type SproutKind } from "@/lib/sprout-kind";
import { setSproutStateAction, setSproutDateAction, setSproutKindAction } from "../actions";
import { FactPopover } from "./fact-popover";
import { OverlaySheet } from "./overlay-sheet";
import { sweepRejection } from "@/lib/sweep-rejection";
import { PlantHeader } from "@/components/plant-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChoiceLabel, NativeRadio } from "@/components/ui/native-controls";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A sprout's head: the name, the one-line description, and the three things a
 * sprout IS — a state, a date, a kind — as three icons under it.
 *
 * `plant-hero.tsx`'s shape, on the entity one tier down, and deliberately beat
 * for beat: an author moving between a plant and a sprout should find the same
 * gestures. The layout is the SAME FILE (`components/plant-header.tsx`), with
 * no mark — a sprout has no logo, and a monogram for a piece of writing is a
 * decoration standing where a fact belongs.
 *
 * The shell is the exception, never the write path. `metaForm` is
 * server-rendered by the page and handed down, so this file never composes a
 * payload for it; the three it renders itself are real `<form>`s posting one
 * field each to a one-field server action.
 *
 * NONE OF THE THREE WRITES ON THE CLICK THAT OPENS IT, and state earns that
 * harder than the plant's two enums do: publishing a sprout makes its derived
 * plant public with it (`publishCascade`, lib/data.ts — the bean and pod
 * above it are not touched, and there is no unpublish cascade in the other
 * direction). A one-click flip is a mis-click away from publishing a project,
 * and the undo is another mis-click on the same pixel that does NOT take the
 * plant back with it — which is why Save confirms. Kind is the second enum here
 * (lib/sprout-kind.ts), and the same radios-plus-Save for the same reason: one
 * of its members, `digest`, changes what publishing does.
 */

export interface SproutHeroProps {
  slug: string;
  name: string;
  description: string;
  state: SproutState;
  date: string;
  kind: SproutKind;
  /**
   * The half being edited, from the page's `?lang=` (lib/edit-lang.ts). Each
   * of the three forms this component renders itself posts it as a hidden
   * field — not to choose what gets written (none of state, date or kind has
   * an fr/en half), but so `sproutHref`'s redirect (app/admin/actions.ts)
   * lands the author back on the half they were editing rather than on the
   * English editor.
   */
  lang: Lang;
  /** A rejected save's message, and which surface it came from. */
  error?: string;
  errorForm?: Surface;
  /**
   * The server-rendered meta form. A prop rather than an import: it is a server
   * component reaching a server action, and passing it down is what keeps this
   * file free of every field name on the sprout.
   */
  metaForm: ReactNode;
  /**
   * A fingerprint of everything this head can write, computed by the page from
   * the STORED sprout. A successful save redirects to this same route — a soft
   * navigation, so this component keeps its place in the tree and nothing
   * resets itself. The re-render carrying a different fingerprint is the only
   * honest signal that the write landed, so it is what closes the surface. A
   * save that changed nothing leaves it open, which is the truth.
   *
   * It covers ALL FOUR surfaces, which is a correction to `plant-hero.tsx`'s
   * rather than a copy of it: that one fingerprints name, description, role and
   * logo but not status or visibility, so a status save leaves its popover open
   * over a freshly-disabled Save.
   */
  saved: string;
}

/** The surfaces this head can open, one at a time — tracked in one place rather
 *  than in four independently uncontrolled primitives. */
export type Surface = "meta" | "state" | "date" | "kind";

export function SproutHero({
  slug,
  name,
  description,
  state,
  date,
  kind,
  lang,
  error,
  errorForm,
  metaForm,
  saved,
}: SproutHeroProps) {
  const [open, setOpen] = useState<Surface | null>(null);
  const [seenSaved, setSeenSaved] = useState(saved);

  // Controlled, so the primitive cannot infer where focus came from: the sheet
  // is opened from the title and reopened by a rejected save.
  const titleRef = useRef<HTMLButtonElement>(null);

  // A rejected save redirects here with ?form=…&error=… and the field it
  // rejected is behind a closed surface, so the banner would have nowhere to
  // live. Reopen onto it rather than land the author on a page that says
  // nothing went wrong. (Their edit is gone either way; the message is what is
  // salvageable.)
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
  // surface. lib/sweep-rejection.ts carries the argument and the replaceState;
  // it is shared with the other head and with entity-rail.tsx rather than
  // written out a third time.
  const close = (): void => {
    setOpen(null);
    sweepRejection();
  };

  const surface = (next: Surface | null) => (next ? setOpen(next) : close());

  return (
    <TooltipProvider>
      <PlantHeader
        /* No mark. See components/plant-header.tsx's prop comment: absent is a
           statement about the entity, not a mark that failed to load. */
        title={
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
        }
        description={description}
        facts={
          <div className="flex items-center gap-1">
            {/* State. Radios plus a Save disabled until the pick differs from
                what is stored — the second click is a confirmation rather than
                a formality. */}
            <FactPopover
              open={open === "state"}
              onOpenChange={(next) => surface(next ? "state" : null)}
              error={errorForm === "state" ? error : undefined}
              label={`State: ${sproutStateLabel(state)}`}
              icon={SPROUT_STATE_ICONS[state]}
              tone={
                state === "published"
                  ? "text-primary"
                  : state === "private"
                    ? "text-foreground"
                    : undefined
              }
            >
              <StateForm slug={slug} current={state} lang={lang} />
            </FactPopover>

            {/* Date. NOT an enum: there is no vocabulary to draw as radios, and
                a field's "differs from stored" is what the author can already
                see in the field, so the Save is a plain submit. The SHAPE is
                still guarded — lib/sprout-date.ts, at the action. */}
            <FactPopover
              open={open === "date"}
              onOpenChange={(next) => surface(next ? "date" : null)}
              error={errorForm === "date" ? error : undefined}
              label={`Date: ${date}`}
              icon={Calendar}
            >
              <FieldForm
                slug={slug}
                action={setSproutDateAction}
                field="date"
                inputType="date"
                current={date}
                heading="Date"
                hint="When this sprout is dated on every timeline it appears in."
                lang={lang}
              />
            </FactPopover>

            {/* Kind. The vocabulary that replaced the free string `type`
                (spec 2026-10-10 §1.2), so it gets the enum rule: radios plus a
                Save disabled until the pick differs. */}
            <FactPopover
              open={open === "kind"}
              onOpenChange={(next) => surface(next ? "kind" : null)}
              error={errorForm === "kind" ? error : undefined}
              label={`Kind: ${sproutKindLabel(kind)}`}
              icon={SPROUT_KIND_ICONS[kind]}
            >
              <KindForm slug={slug} current={kind} lang={lang} />
            </FactPopover>
          </div>
        }
      />

      <OverlaySheet
        open={open === "meta"}
        onOpenChange={(next) => surface(next ? "meta" : null)}
        label="Edit sprout meta"
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
 * The state vocabulary, drawn as native radios.
 *
 * The words come from `lib/glyphs.ts` and the icons from the admin tables' own
 * map, so a state reads the same on `/admin/sprouts` and on this head. The
 * hints are the only new prose, and they exist because what each state DOES is
 * invisible from this page.
 *
 * Not the Base UI RadioGroup: that one submits through a script-populated
 * hidden input, and a real radio is what keeps this form a form.
 */
function StateForm({ slug, current, lang }: { slug: string; current: SproutState; lang: Lang }) {
  const [picked, setPicked] = useState<SproutState>(current);

  return (
    <form action={setSproutStateAction} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="lang" value={lang} />

      <div className="flex flex-col gap-2">
        {SPROUT_STATES.map((option) => {
          const Icon = SPROUT_STATE_ICONS[option];
          const id = `state-${option}`;
          return (
            <ChoiceLabel key={option} htmlFor={id} className="items-start gap-2.5">
              <NativeRadio
                id={id}
                name="state"
                value={option}
                checked={picked === option}
                onChange={() => setPicked(option)}
                className="mt-0.5"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-1.5">
                  <Icon className="size-3.5 text-muted-foreground" />
                  {sproutStateLabel(option)}
                </span>
                <span className="text-xs leading-snug text-muted-foreground">
                  {STATE_HINTS[option]}
                </span>
              </span>
            </ChoiceLabel>
          );
        })}
      </div>

      <div className="flex justify-end">
        {/* Disabled until the pick differs from what is stored. Without it the
            Save is a formality — two clicks that mean exactly what one click
            meant — and the confirmation this popover exists to add is gone. */}
        <Button type="submit" size="sm" disabled={picked === current}>
          Save
        </Button>
      </div>
    </form>
  );
}

const STATE_HINTS: Record<SproutState, string> = {
  draft: "Being written. Off the public site.",
  private: "Finished but held back. Still off the public site.",
  published:
    "On the public site — and its plant is made public with it, unless it is a digest. Its beans and pods are not touched.",
};

/**
 * The kind vocabulary, drawn as native radios — `StateForm` over the other
 * enum. The words are `lib/glyphs.ts`'s and the icons the admin tables' own,
 * so a kind reads the same on `/admin/sprouts` as on this head; the hints are
 * the only new prose, because what a kind MEANS is invisible from this page,
 * and one of them (digest) changes what the state control does.
 */
function KindForm({ slug, current, lang }: { slug: string; current: SproutKind; lang: Lang }) {
  const [picked, setPicked] = useState<SproutKind>(current);

  return (
    <form action={setSproutKindAction} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="lang" value={lang} />

      <div className="flex flex-col gap-2">
        {SPROUT_KINDS.map((option) => {
          const Icon = SPROUT_KIND_ICONS[option];
          const id = `kind-${option}`;
          return (
            <ChoiceLabel key={option} htmlFor={id} className="items-start gap-2.5">
              <NativeRadio
                id={id}
                name="kind"
                value={option}
                checked={picked === option}
                onChange={() => setPicked(option)}
                className="mt-0.5"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-1.5">
                  <Icon className="size-3.5 text-muted-foreground" />
                  {sproutKindLabel(option)}
                </span>
                <span className="text-xs leading-snug text-muted-foreground">
                  {KIND_HINTS[option]}
                </span>
              </span>
            </ChoiceLabel>
          );
        })}
      </div>

      <div className="flex justify-end">
        {/* Disabled until the pick differs, for StateForm's reason. */}
        <Button type="submit" size="sm" disabled={picked === current}>
          Save
        </Button>
      </div>
    </form>
  );
}

const KIND_HINTS: Record<SproutKind, string> = {
  log: "A dated note on work done — the default.",
  milestone: "A state reached: shipped, launched, recorded.",
  release: "A tagged version, usually mirrored from a feed.",
  essay: "A retrospective, a reflection, a learning.",
  decision: "A choice made, and why.",
  digest: "The machine-written weekly wrap. Publishing one marks review, and does not make its plant public.",
};

/**
 * One date field: an input and a Save. Kept general (`field`, `inputType`) from
 * when it also drew the free-text `type`; today `date` is its only caller.
 *
 * No disabled-until-changed guard, unlike `StateForm`. That guard exists to
 * make a second click a confirmation of a choice the author might not have
 * meant; here the author has typed, and what they typed is on screen.
 */
function FieldForm({
  slug,
  action,
  field,
  inputType,
  current,
  heading,
  hint,
  lang,
}: {
  slug: string;
  action: (formData: FormData) => Promise<void>;
  field: "date";
  inputType: "date" | "text";
  current: string;
  heading: string;
  hint: string;
  lang: Lang;
}) {
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="lang" value={lang} />
      <div className="flex flex-col gap-2">
        <Label htmlFor={`field-${field}`}>{heading}</Label>
        <Input
          id={`field-${field}`}
          type={inputType}
          name={field}
          defaultValue={current}
          required
        />
        <p className="text-xs leading-snug text-muted-foreground">{hint}</p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          Save
        </Button>
      </div>
    </form>
  );
}
