"use client";

import { useId } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LANGS, LANG_SHORT, type Lang } from "@/lib/locale";
import { cn } from "@/lib/utils";

// Appended as an sr-only suffix, never the whole accessible name: the code
// ("EN"/"FR") is what's on screen, and WCAG 2.5.3 wants the accessible name to
// START with it, not be replaced by something a sighted user never sees.
const EDIT_SUFFIX: Record<Lang, string> = { en: "edit English", fr: "edit French" };

/**
 * Which half of the article the editor is on, and the way to the other one.
 *
 * Drawn by ProseEditor, which is the only thing that knows whether there is
 * unsaved text — hence `disabled`. While disabled there is NO `href` at all:
 * the editor has no beforeunload guard, so a live link would navigate, drop
 * the paragraph, and open an editor on the other half that looks exactly like
 * one where the paragraph was never written.
 *
 * A disabled item is still an `<a role="link" tabIndex={0}>`, never a bare
 * `<span>`: a `<span>` is a generic element, so `aria-current` and an
 * accessible name on it are silently dropped, and assistive tech gets plain
 * "EN FR". `aria-disabled` (not `disabled`, which isn't valid on an anchor)
 * says the state without removing the element from the tree.
 *
 * The "why disabled" hint is a registry `Tooltip`, not a `title`: `title`
 * never surfaces on an element carrying `cursor-not-allowed`'s sibling
 * `pointer-events-none` (dropped for that reason, in favour of
 * `cursor-not-allowed` alone) and is unreachable from a keyboard regardless.
 * Both disabled items point `aria-describedby` at the SAME `sr-only` span
 * holding "Save first" — announced on focus even before the tooltip's own
 * hover/focus delay opens its popup, and assertable from static markup, which
 * the popup itself never renders into.
 */
export function EditLangSwitch({
  current,
  hrefs,
  disabled,
}: {
  current: Lang;
  hrefs: Record<Lang, string>;
  disabled: boolean;
}) {
  const hintId = useId();
  return (
    <div role="group" aria-label="Language being edited" className="flex items-center gap-0.5">
      {LANGS.map((lang) => {
        const active = lang === current;
        const className = cn(buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" }));
        const content = (
          <>
            {LANG_SHORT[lang]}
            <span className="sr-only"> — {EDIT_SUFFIX[lang]}</span>
          </>
        );
        if (!disabled) {
          return (
            <Link key={lang} href={hrefs[lang]} aria-current={active ? "page" : undefined} className={className}>
              {content}
            </Link>
          );
        }
        return (
          <Tooltip key={lang}>
            <TooltipTrigger
              render={
                <a
                  role="link"
                  tabIndex={0}
                  aria-disabled="true"
                  aria-current={active ? "page" : undefined}
                  aria-describedby={hintId}
                  className={cn(className, "cursor-not-allowed opacity-50")}
                />
              }
            >
              {content}
            </TooltipTrigger>
            <TooltipContent>Save first</TooltipContent>
          </Tooltip>
        );
      })}
      {disabled ? (
        <span id={hintId} className="sr-only">
          Save first
        </span>
      ) : null}
    </div>
  );
}
