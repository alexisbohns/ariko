"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Calendar, Tag } from "lucide-react";
import type { SproutState } from "@/lib/data";
import { SPROUT_STATE_ICONS } from "@/components/admin/glyphs";
import { sproutStateLabel } from "@/lib/glyphs";
import { SPROUT_STATES } from "@/lib/sprout-state";
import { setSproutStateAction, setSproutDateAction, setSproutTypeAction } from "../actions";
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
 * A sprout's head: the name, the one-line description, and the three things a
 * sprout IS — a state, a date, a type — as three icons under it.
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
 * harder than the plant's two enums do: publishing a sprout cascades upward
 * through its bean, pod and plant, and un-publishing runs the downward
 * recompute. A one-click flip is a mis-click away from publishing a project's
 * whole spine, and the undo is another mis-click on the same pixel.
 */

export interface SproutHeroProps {
  slug: string;
  name: string;
  description: string;
  state: SproutState;
  date: string;
  type: string;
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
export type Surface = "meta" | "state" | "date" | "type";

export function SproutHero({
  slug,
  name,
  description,
  state,
  date,
  type,
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
  // surface: close, reload, and the banner comes back about an edit that no
  // longer exists in any field. Dropped with replaceState rather than a router
  // push — this is tidying the URL, not a navigation, and a navigation here
  // would re-render the page under the closing sheet.
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
              <StateForm slug={slug} current={state} />
            </FactPopover>

            {/* Date and type. NOT enums: `type` is free-form (lib/sprouts.ts
                filters by state, plant and tag and never by type), so there is
                no vocabulary to draw as radios. A text field's "differs from
                stored" is what the author can already see in the field, so the
                Save is a plain submit. */}
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
              />
            </FactPopover>

            <FactPopover
              open={open === "type"}
              onOpenChange={(next) => surface(next ? "type" : null)}
              error={errorForm === "type" ? error : undefined}
              label={`Type: ${type}`}
              icon={Tag}
            >
              <FieldForm
                slug={slug}
                action={setSproutTypeAction}
                field="type"
                inputType="text"
                current={type}
                heading="Type"
                hint="Free text. A type of “digest” exempts this sprout from the publish cascade."
              />
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
 * One fact: an icon that opens its editor, and nothing else.
 *
 * The icon is a trigger and NOT a submit — the whole point. The form lives
 * inside the popover, which Base UI unmounts on close, so an abandoned edit is
 * discarded with nothing to reset by hand. An abandoned edit is not a pending
 * write.
 *
 * `aria-label` states the STORED value, on the control rather than on a visible
 * span, because the hover label is CSS. `lib/sprout-hero-a11y.test.ts` pins it.
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
   * A rejected save's message, when this is the surface it came from.
   *
   * It has to render HERE, beside the field, and that is the entire point of
   * routing `?form=` back to a surface: reopening a popover onto silence tells
   * the author only that their click did nothing. The page-level banner cannot
   * cover for it either — the page suppresses that banner precisely when
   * `?form=` names a surface, so without this line the message is not shown
   * anywhere at all.
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
function StateForm({ slug, current }: { slug: string; current: SproutState }) {
  const [picked, setPicked] = useState<SproutState>(current);

  return (
    <form action={setSproutStateAction} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />

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
  draft: "Being written. Off the public site, and off it for its bean too.",
  private: "Finished but held back. Still off the public site.",
  published:
    "On the public site — and its bean, pod and plant are made public with it, unless it is a digest.",
};

/**
 * One free-text or date field: an input and a Save.
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
}: {
  slug: string;
  action: (formData: FormData) => Promise<void>;
  field: "date" | "type";
  inputType: "date" | "text";
  current: string;
  heading: string;
  hint: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
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
