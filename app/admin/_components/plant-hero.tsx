"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Crown, Globe, Lock, Pencil, Zap, ZapOff } from "lucide-react";
import type { PlantStatus, Visibility } from "@/lib/data";
import { visibilityLabel } from "@/lib/glyphs";
import { PLANT_STATUSES, statusLabel } from "@/lib/plant-status";
import { PLANT_VISIBILITIES } from "@/lib/plant-visibility";
import { setPlantStatusAction, setPlantVisibilityAction } from "../actions";
import { OverlaySheet } from "./overlay-sheet";
import { PlantHeader, PlantMarkContent, PLANT_MARK } from "@/components/plant-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChoiceLabel, NativeRadio } from "@/components/ui/native-controls";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * The plant's head: the mark, the name, and the three things a plant IS —
 * a role, a status, a visibility — as three icons under it.
 *
 * A client island, and a deliberate one: the five editors that used to be five
 * stacked cards are now a popover (logo), a popover-then-sheet (role), a sheet
 * (meta) and two option popovers (status, visibility). CLAUDE.md's exception
 * list grows by this file — script-off, the header renders as a mark, a name
 * and five inert icons, and nothing on it can be edited.
 *
 * The shell is the exception, never the write path — the same line the seed
 * overlay draws. The three big forms are server-rendered and handed down as
 * props (`metaForm`, `roleForm`, `logoForm`), so this file never composes a
 * payload for them; the two it does render itself are real <form>s posting a
 * named vocabulary member to a one-field server action.
 *
 * NEITHER enum field writes on the click that opens it. An icon that flipped a
 * plant's visibility on a single stray click is a mis-click away from
 * unpublishing a project, and the undo is another stray click on the same
 * pixel — indistinguishable, after the fact, from never having pressed it. So
 * the icon opens the vocabulary, the author picks a member, and a Save button
 * commits it. The Save is disabled until the pick actually differs from what is
 * stored, which is what makes the second click a confirmation rather than a
 * formality.
 */

export interface PlantHeroProps {
  slug: string;
  name: string;
  description: string;
  logoUrl?: string;
  status: PlantStatus;
  visibility: Visibility;
  /** The role, already resolved to words by lib/plant-role.ts. */
  role: { label: string; title: string | null; detail: string };
  /** A rejected save's message, and which sheet it came from. */
  error?: string;
  errorForm?: "meta" | "role";
  /**
   * The server-rendered forms. Props rather than imports: they are server
   * components reaching server actions, and passing them down is what keeps
   * this file free of every field name on the plant.
   */
  metaForm: ReactNode;
  roleForm: ReactNode;
  logoForm: ReactNode;
  /**
   * A fingerprint of everything the three editors can write, computed by the
   * page from the STORED plant. A successful save redirects to this same route
   * — a soft navigation, so this component keeps its place in the tree and
   * nothing resets itself. The re-render carrying a different fingerprint is
   * the only honest signal that the write landed, so it is what closes the
   * sheet. (The seed overlay counts the inbox for exactly this reason.) A save
   * that changed nothing leaves the sheet open, which is the truth.
   */
  saved: string;
}

export function PlantHero({
  slug,
  name,
  description,
  logoUrl,
  status,
  visibility,
  role,
  error,
  errorForm,
  metaForm,
  roleForm,
  logoForm,
  saved,
}: PlantHeroProps) {
  // One surface open at a time, tracked in one place rather than in four
  // independently uncontrolled primitives — the role's Edit button has to
  // close the popover it lives in and open a sheet in the same click.
  const [open, setOpen] = useState<Surface>(null);
  const [seenSaved, setSeenSaved] = useState(saved);

  // Controlled, so the primitive cannot infer where focus came from. Focus
  // returns to whatever opened the sheet, whichever route it took.
  const titleRef = useRef<HTMLButtonElement>(null);
  const crownRef = useRef<HTMLButtonElement>(null);

  // A rejected save redirects here with ?form=…&error=… and the form it came
  // from is behind a closed sheet, so the banner would have nowhere to live.
  // Reopen onto it rather than land the author on a page that says nothing
  // went wrong. (Their edits are gone either way; the message is what is
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

  // A rejected save leaves ?form=&error= in the URL, and they outlive the
  // sheet: close it, reload, and the banner comes back about an edit that no
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

  const sheet = (next: "meta" | "role" | null) => (next ? setOpen(next) : close());

  return (
    <TooltipProvider>
      <PlantHeader
        /* The mark edits itself, in place: a popover rather than a sheet,
           because a logo is one field and the author needs to see the mark they
           are replacing while they replace it. The box and its contents are the
           public page's (components/plant-header.tsx); what the admin adds is
           that it is a button. */
        mark={
          <Popover open={open === "logo"} onOpenChange={(next) => setOpen(next ? "logo" : null)}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label="Logo"
                  className={`group relative ${PLANT_MARK} transition-shadow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring`}
                >
                  <PlantMarkContent logoUrl={logoUrl} name={name} />
                  {/* The affordance, on hover only — a pencil parked on the mark
                      at rest would be the loudest thing on a page whose whole
                      point is quiet. */}
                  <span className="absolute inset-0 flex items-center justify-center bg-background/70 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Pencil className="size-5" />
                  </span>
                </button>
              }
            />
            <PopoverContent side="bottom" className="w-80">
              {logoForm}
            </PopoverContent>
          </Popover>
        }
        /* Inside the h1, never instead of it — PlantHeader renders the heading
           in both zones, so the page keeps exactly one document title. */
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
            {/* Role. The only one of the three that cannot be a toggle: it is
                four kinds and two bilingual free-text fields, so the icon opens
                a summary and the summary opens the sheet. */}
            <Popover
              open={open === "rolePopover"}
              onOpenChange={(next) => setOpen(next ? "rolePopover" : null)}
            >
              <Tooltip>
                <TooltipTrigger
                  render={
                    <PopoverTrigger
                      render={
                        <Button
                          ref={crownRef}
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Role: ${role.label}`}
                        >
                          <Crown className="size-4" />
                        </Button>
                      }
                    />
                  }
                />
                <TooltipContent side="bottom">{roleLine(role)}</TooltipContent>
              </Tooltip>
              <PopoverContent side="bottom" className="w-72 text-left">
                <div className="flex flex-col gap-1">
                  <p className="font-heading text-sm tracking-tight">{roleLine(role)}</p>
                  {role.detail ? (
                    <p className="text-xs text-muted-foreground">{role.detail}</p>
                  ) : null}
                  {/* Said on the popover's face, deliberately: there is no
                      private role. If the plant is public, everything here is
                      too — detail included. */}
                  <p className="text-xs text-muted-foreground">
                    Shown publicly, on this plant&rsquo;s page and on the landing gallery.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="outline" onClick={() => setOpen("role")}>
                    <Pencil /> Edit
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Status and visibility. Each icon opens its own vocabulary rather
                than flipping the field under the pointer — see the note at the
                top of this file on why a one-click write was the wrong shape for
                these two. */}
            <EnumPopover
              open={open === "status"}
              onOpenChange={(next) => setOpen(next ? "status" : null)}
              action={setPlantStatusAction}
              slug={slug}
              field="status"
              current={status}
              options={STATUS_OPTIONS}
              label={`Status: ${statusLabel(status)}`}
            />

            <EnumPopover
              open={open === "visibility"}
              onOpenChange={(next) => setOpen(next ? "visibility" : null)}
              action={setPlantVisibilityAction}
              slug={slug}
              field="visibility"
              current={visibility}
              options={VISIBILITY_OPTIONS}
              label={`Visibility: ${visibilityLabel(visibility)}`}
            />
          </div>
        }
      />

      <OverlaySheet
        open={open === "meta"}
        onOpenChange={(next) => sheet(next ? "meta" : null)}
        label="Edit plant meta"
        finalFocus={titleRef}
      >
        <div className="flex w-full max-w-xl flex-col gap-6">
          <SheetHeading>{name}</SheetHeading>
          {error && errorForm === "meta" ? <SaveError message={error} /> : null}
          {metaForm}
        </div>
      </OverlaySheet>

      <OverlaySheet
        open={open === "role"}
        onOpenChange={(next) => sheet(next ? "role" : null)}
        label="Edit plant role"
        finalFocus={crownRef}
      >
        <div className="flex w-full max-w-xl flex-col gap-6">
          <SheetHeading>Role · {name}</SheetHeading>
          {error && errorForm === "role" ? <SaveError message={error} /> : null}
          {roleForm}
        </div>
      </OverlaySheet>
    </TooltipProvider>
  );
}

/** The one-line role, composed here rather than imported: `lib/plant-role.ts`
 *  is where the WORDS are decided, and this is only their punctuation. */
function roleLine(role: { label: string; title: string | null }): string {
  return role.title ? `${role.label} · ${role.title}` : role.label;
}

function SheetHeading({ children }: { children: ReactNode }) {
  return (
    <p className="text-center font-heading text-xs uppercase tracking-[0.15em] text-muted-foreground">
      {children}
    </p>
  );
}

function SaveError({ message }: { message: string }) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

/** The surfaces this header can open, one at a time — the role's Edit button
 *  has to close the popover it lives in and open a sheet in the same click,
 *  which two independently uncontrolled primitives cannot coordinate. */
type Surface = "meta" | "role" | "logo" | "rolePopover" | "status" | "visibility" | null;

interface EnumOption {
  value: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** What choosing it actually does, in the author's terms. */
  hint: string;
  /** The icon's colour when this is the STORED value — the trigger's whole job. */
  tone?: string;
}

/**
 * The two vocabularies, drawn.
 *
 * The words come from `lib/plant-status.ts` and `lib/glyphs.ts` rather than
 * from string literals here, and the icons are the ones the admin tables
 * already use for the same values — a visibility reads the same on the garden
 * table and on this header. The hints are the only new prose, and they exist
 * because both fields have an effect that is invisible from this page (the Meta
 * card used to carry the status one in its CardDescription).
 */
const STATUS_OPTIONS: EnumOption[] = PLANT_STATUSES.map((status) =>
  status === "active"
    ? {
        value: status,
        label: statusLabel(status),
        icon: Zap,
        hint: "Still being worked on.",
        tone: "text-primary",
      }
    : {
        value: status,
        label: statusLabel(status),
        icon: ZapOff,
        hint: "Still shown publicly, under the landing gallery's Inactive heading.",
      },
);

const VISIBILITY_OPTIONS: EnumOption[] = PLANT_VISIBILITIES.map((visibility) =>
  visibility === "public"
    ? {
        value: visibility,
        label: visibilityLabel(visibility),
        icon: Globe,
        hint: "On the landing gallery, with its own page.",
      }
    : {
        value: visibility,
        label: visibilityLabel(visibility),
        icon: Lock,
        hint: "Hidden entirely — the plant and everything under it leave the public site.",
        tone: "text-foreground",
      },
);

/**
 * One enum field: an icon that opens its vocabulary, and a Save that commits it.
 *
 * The icon is a trigger and NOT a submit — the whole point of this component.
 * The form lives inside the popover, so the write takes two deliberate acts
 * (pick, then Save) and the second one is disabled until the first changed
 * something.
 *
 * The form posts the value the author PICKED, and the action validates it as a
 * member of a vocabulary rather than trusting the client (app/admin/actions.ts
 * says the same from its side). That is what makes a stale page harmless: it
 * can only ever name a value this vocabulary already has.
 */
function EnumPopover({
  open,
  onOpenChange,
  action,
  slug,
  field,
  current,
  options,
  label,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  action: (formData: FormData) => Promise<void>;
  slug: string;
  field: "status" | "visibility";
  current: string;
  options: EnumOption[];
  label: string;
}) {
  const stored = options.find((option) => option.value === current) ?? options[0];
  const Icon = stored.icon;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button type="button" size="icon" variant="ghost" aria-label={label}>
                  <Icon className={`size-4 ${stored.tone ?? "text-muted-foreground"}`} />
                </Button>
              }
            />
          }
        />
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>

      {/* The form is INSIDE the popover, which Base UI unmounts on close — so
          the pending selection below is discarded by closing, with nothing to
          reset by hand. An abandoned pick is not a pending write. */}
      <PopoverContent side="bottom" align="center" className="w-72 text-left">
        <EnumForm action={action} slug={slug} field={field} current={current} options={options} />
      </PopoverContent>
    </Popover>
  );
}

function EnumForm({
  action,
  slug,
  field,
  current,
  options,
}: {
  action: (formData: FormData) => Promise<void>;
  slug: string;
  field: "status" | "visibility";
  current: string;
  options: EnumOption[];
}) {
  const [picked, setPicked] = useState(current);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />

      {/* Native radios, styled — `components/ui/native-controls.tsx`. Not the
          Base UI RadioGroup: that one submits through a script-populated hidden
          input, and a real radio is what keeps this form a form. */}
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const Icon = option.icon;
          const id = `${field}-${option.value}`;
          return (
            <ChoiceLabel key={option.value} htmlFor={id} className="items-start gap-2.5">
              <NativeRadio
                id={id}
                name={field}
                value={option.value}
                checked={picked === option.value}
                onChange={() => setPicked(option.value)}
                className="mt-0.5"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-1.5">
                  <Icon className={`size-3.5 ${option.tone ?? "text-muted-foreground"}`} />
                  {option.label}
                </span>
                <span className="text-xs leading-snug text-muted-foreground">{option.hint}</span>
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
