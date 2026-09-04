"use client";

import {
  Bot,
  CircleDashed,
  GitPullRequest,
  Globe,
  Lock,
  Package,
  Rss,
  ScrollText,
  Sprout,
  User,
  Webhook,
} from "lucide-react";
import type { ComponentType } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Visibility } from "@/lib/data";
import { cloudinaryThumb } from "@/lib/image-url";
import { initialsOf, sourceLabel, tierLabel, visibilityLabel, type Tier } from "@/lib/glyphs";
import { cn } from "@/lib/utils";

/**
 * The glyphs the three admin tables draw instead of spelling values out: a
 * source's icon, an entity's avatar, a visibility, a tier.
 *
 * ONE client island for all three tables, and a small one — a lucide icon is
 * already a client module (`components/media.tsx` documents why the public zone
 * refuses them outright), Base UI's Avatar and Tooltip are too, so the choice
 * was never "no client JS here" but "one boundary or nine". Nothing in this
 * file is a form control and nothing here writes: the tables around it stay the
 * server-rendered links and cells they were, which is why this is not a fourth
 * entry in CLAUDE.md's list of exceptions.
 *
 * The words come from `lib/glyphs.ts` — every glyph names itself in a tooltip
 * AND in an `sr-only` span, so an icon is never the only carrier of a value for
 * a screen reader. The tooltip is what a sighted reader hovers; the sr-only
 * text is what makes the cell readable without hovering at all.
 */

/** Trigger delay. The chrome opens its tooltips instantly; a table is dense
 *  enough that a pointer crossing it would otherwise strobe. */
const DELAY = 200;

/**
 * A focusable icon that names itself. A <button> (Base UI's default trigger)
 * rather than a bare <span>: a tooltip that only opens on hover is invisible to
 * a keyboard, and the label is the cell's actual content here, not decoration.
 */
function IconGlyph({
  icon: Icon,
  label,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={DELAY}
        type="button"
        className={cn(
          "inline-flex cursor-default items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          className,
        )}
      >
        <Icon className="size-4" />
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The known source kinds, drawn. `Source.kind` is a free string by design
 * (`/api/inbox` accepts whatever a token is scoped for), so the fallback is a
 * real member of this table rather than an error: an unheard-of kind gets the
 * dashed circle and keeps its own raw name in the tooltip.
 *
 * No GitHub mark, and not by oversight — lucide dropped its brand icons, and a
 * hand-pasted Octocat path would be the one icon in the admin that no registry
 * owns. A pull request is what a `github` seed actually is here (the lab-note
 * pipeline posts on merge), so `GitPullRequest` is the honest glyph, not a
 * substitute for one.
 */
const SOURCE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  manual: User,
  github: GitPullRequest,
  changelog: ScrollText,
  pollen: Rss,
  arkaik: Bot,
  api: Webhook,
};

export function SourceGlyph({ kind }: { kind: string }) {
  return <IconGlyph icon={SOURCE_ICONS[kind] ?? CircleDashed} label={sourceLabel(kind)} />;
}

/** What an avatar needs, and nothing more — plain strings, so a server
 *  component can hand one across the boundary without thinking about it. */
export interface EntityMark {
  name: string;
  /** Shown under the name in the tooltip. The slug, usually. */
  hint?: string;
  /** A stored logo's URL. Absent ⇒ the fallback initials carry the entity. */
  logoUrl?: string;
}

const AVATAR_PX = 24; // size-6, the `sm` avatar — asked for at 2x below

/**
 * A squircle, not a circle, and no border ring.
 *
 * The admin's ghost icon buttons — the inbox's `+`, the chrome's rail and its
 * top-right pair — are borderless rounded squares, so a circular mark would be
 * the one round thing in the zone. This is the design system's OWN answer at
 * this size rather than a number picked to look close: it is the exact radius
 * `components/ui/button.tsx` gives its `icon-xs` (size-6) variant, which is why
 * it is written as the same `min()` expression and not as `rounded-lg`.
 * `rounded-lg` is 0.875rem — more than half of a 24px box, so it would clamp
 * back to a circle and quietly undo the change.
 *
 * The border goes with it: `components/ui/avatar.tsx` ships a blend-mode ring
 * on `::after` for a circular photo avatar, and against a table row it reads as
 * a chip nobody asked for. Suppressed here, in the consumer — the registry
 * primitive stays as shipped, so the next avatar in this repo starts round and
 * ringed like every other shadcn one.
 */
const SQUIRCLE = "rounded-[min(var(--radius-md),10px)]";

function AvatarMark({ mark, className }: { mark: EntityMark; className?: string }) {
  return (
    <Avatar size="sm" className={cn("shrink-0 after:hidden", SQUIRCLE, className)}>
      {mark.logoUrl ? (
        <AvatarImage
          className={SQUIRCLE}
          src={cloudinaryThumb(mark.logoUrl, { width: AVATAR_PX * 2, height: AVATAR_PX * 2 })}
          alt=""
        />
      ) : null}
      {/* 8px in a 24px box — a third of it, where a monogram avatar usually
          sits at ~40%. Two uppercase letters is all this ever renders
          (initialsOf caps it), so the mark reads as a mark and stops competing
          with the row's own text. */}
      <AvatarFallback className={cn("font-heading text-[0.5rem] tracking-tight", SQUIRCLE)}>
        {initialsOf(mark.name)}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * The mark alone — decorative, because the name it stands for is rendered right
 * beside it (the garden's name column). `aria-hidden`, so a screen reader reads
 * the name once rather than twice.
 */
export function EntityAvatar({ mark, className }: { mark: EntityMark; className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex", className)}>
      <AvatarMark mark={mark} />
    </span>
  );
}

/**
 * The mark AS the value — where the avatar replaces a slug the cell used to
 * print (the vault's plant column, the inbox's source column). It names itself,
 * so the column loses its words on screen and not in the accessibility tree.
 */
export function EntityAvatarGlyph({ mark }: { mark: EntityMark }) {
  const label = mark.hint && mark.hint !== mark.name ? `${mark.name} · ${mark.hint}` : mark.name;
  return (
    <Tooltip>
      <TooltipTrigger
        delay={DELAY}
        type="button"
        className={cn(
          "inline-flex cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          SQUIRCLE,
        )}
      >
        <AvatarMark mark={mark} />
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The inbox's source column: where a seed came from, and what it is headed for.
 *
 * `manual · · · (PB)` — the icon is the capture route, the avatar is the plant
 * the payload SUGGESTED, and the dots are the run between them. The suggestion
 * is a suggestion, not a parent: an untriaged seed has none yet. So the avatar
 * is simply absent when nothing was suggested, and absent too when the
 * suggested slug matches no plant in the garden — a dangling suggestion draws
 * nothing rather than an avatar for an entity that is gone.
 */
export function SeedSourceGlyph({ kind, plant }: { kind: string; plant?: EntityMark }) {
  return (
    <span className="inline-flex items-center gap-1">
      <SourceGlyph kind={kind} />
      {plant ? (
        <>
          <span
            aria-hidden
            className="select-none text-[0.65rem] leading-none tracking-[0.05em] text-muted-foreground/50"
          >
            ···
          </span>
          <EntityAvatarGlyph mark={plant} />
        </>
      ) : null}
    </span>
  );
}

export function VisibilityGlyph({ visibility }: { visibility: Visibility }) {
  return (
    <IconGlyph
      icon={visibility === "public" ? Globe : Lock}
      label={visibilityLabel(visibility)}
      className={visibility === "private" ? "text-foreground" : undefined}
    />
  );
}

/** Plant and pod. The same Sprout mark the chrome's Garden item and the vault's
 *  plant filter already use, so one tier reads the same in three places. */
const TIER_ICONS: Record<Tier, ComponentType<{ className?: string }>> = {
  plant: Sprout,
  pod: Package,
};

export function TierGlyph({ tier }: { tier: Tier }) {
  return <IconGlyph icon={TIER_ICONS[tier]} label={tierLabel(tier)} />;
}
