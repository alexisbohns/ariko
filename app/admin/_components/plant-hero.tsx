"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Crown, Globe, Lock, Pencil, Zap, ZapOff } from "lucide-react";
import type { PlantStatus, Visibility } from "@/lib/data";
import { initialsOf, visibilityLabel } from "@/lib/glyphs";
import { cloudinaryThumb } from "@/lib/image-url";
import { nextStatus, statusLabel } from "@/lib/plant-status";
import { nextVisibility } from "@/lib/plant-visibility";
import { setPlantStatusAction, setPlantVisibilityAction } from "../actions";
import { OverlaySheet } from "./overlay-sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * The plant's head: the mark, the name, and the three things a plant IS —
 * a role, a status, a visibility — as three icons under it.
 *
 * A client island, and a deliberate one: the four editors that used to be four
 * stacked cards are now a popover (logo), a popover-then-sheet (role), a sheet
 * (meta) and two one-click forms (status, visibility). CLAUDE.md's exception
 * list grows by this file — script-off, the header renders as a mark, a name
 * and the two toggles, and the three EDITORS are simply not reachable.
 *
 * The shell is the exception, never the write path — the same line the seed
 * overlay draws. Every form here is server-rendered and handed down as a prop
 * (`metaForm`, `roleForm`, `logoForm`); this file never composes a payload, and
 * the two toggles it does render itself are real <form>s posting a named
 * vocabulary member to a one-field server action.
 *
 * Those two toggles therefore work WITHOUT script, which is why they are
 * written as forms rather than as buttons with an onClick: a header that has
 * given up its metadata forms should not give up the two writes that cost
 * nothing to keep.
 */

/** The mark's shape. A superellipse-ish radius as a PERCENTAGE, so the same
 *  class is right at every size this is rendered at — unlike the fixed `min()`
 *  radius `components/admin/glyphs.tsx` uses for its 24px table avatars, which
 *  would read as a barely-rounded square at 112px. */
const SQUIRCLE = "rounded-[28%]";

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
  const [open, setOpen] = useState<"meta" | "role" | "logo" | "rolePopover" | null>(null);
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

  const active = status === "active";
  const isPublic = visibility === "public";

  return (
    <TooltipProvider>
      <header className="flex flex-col items-center gap-5 text-center">
        {/* The mark edits itself, in place: a popover rather than a sheet,
            because a logo is one field and the author needs to see the mark
            they are replacing while they replace it. */}
        <Popover
          open={open === "logo"}
          onOpenChange={(next) => setOpen(next ? "logo" : null)}
        >
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label="Logo"
                className={`group relative size-28 overflow-hidden bg-muted text-muted-foreground transition-shadow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring ${SQUIRCLE}`}
              >
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cloudinaryThumb(logoUrl, { width: 224, height: 224 })}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center font-heading text-3xl tracking-tight">
                    {initialsOf(name)}
                  </span>
                )}
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

        <div className="flex flex-col items-center gap-1.5">
          {/* Still an h1: the sheet trigger is inside the heading rather than
              instead of it, so the page keeps exactly one document title. */}
          <h1 className="font-heading text-3xl font-medium tracking-tight">
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
          </h1>
          {description ? (
            <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          {/* Role. The only one of the three that cannot be a toggle: it is
              four kinds and two bilingual free-text fields, so the icon opens a
              summary and the summary opens the sheet. */}
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

          {/* Status and visibility: one field, two values, one click. Real
              forms, so both survive without script. */}
          <FlipButton
            action={setPlantStatusAction}
            slug={slug}
            field="status"
            value={nextStatus(status)}
            label={`${statusLabel(status)} — click to make ${nextStatus(status)}`}
            icon={
              active ? (
                <Zap className="size-4 text-primary" />
              ) : (
                <ZapOff className="size-4 text-muted-foreground" />
              )
            }
          />

          <FlipButton
            action={setPlantVisibilityAction}
            slug={slug}
            field="visibility"
            value={nextVisibility(visibility)}
            label={`${visibilityLabel(visibility)} — click to make ${nextVisibility(visibility)}`}
            icon={
              isPublic ? (
                <Globe className="size-4 text-muted-foreground" />
              ) : (
                <Lock className="size-4 text-foreground" />
              )
            }
          />
        </div>
      </header>

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

/**
 * One field, one named value, one click.
 *
 * The form posts the value it WANTS rather than "flip it" — so a page rendered
 * before somebody changed the field in another tab cannot flip it into a third
 * state, and the action validates a member of a vocabulary instead of trusting
 * the client's arithmetic (app/admin/actions.ts says the same from its side).
 */
function FlipButton({
  action,
  slug,
  field,
  value,
  label,
  icon,
}: {
  action: (formData: FormData) => Promise<void>;
  slug: string;
  field: "status" | "visibility";
  value: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name={field} value={value} />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button type="submit" size="icon" variant="ghost" aria-label={label}>
              {icon}
            </Button>
          }
        />
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </form>
  );
}
