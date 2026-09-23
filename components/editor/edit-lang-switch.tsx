import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { LANGS, LANG_SHORT, type Lang } from "@/lib/locale";
import { cn } from "@/lib/utils";

const EDIT_LABEL: Record<Lang, string> = { en: "Edit English", fr: "Edit French" };

/**
 * Which half of the article the editor is on, and the way to the other one.
 *
 * Drawn by ProseEditor, which is the only thing that knows whether there is
 * unsaved text — hence `disabled`. While disabled there is NO `href` at all:
 * the editor has no beforeunload guard, so a live link would navigate, drop the
 * paragraph, and open an editor on the other half that looks exactly like one
 * where the paragraph was never written.
 *
 * `next/link`, like every other admin navigation. Admin-only: nothing in the
 * public zone renders this, so it is not a server-safe file.
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
  return (
    <nav aria-label="Language being edited" className="flex items-center gap-0.5">
      {LANGS.map((lang) => {
        const active = lang === current;
        const className = buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" });
        return disabled ? (
          <span
            key={lang}
            aria-disabled="true"
            aria-label={EDIT_LABEL[lang]}
            aria-current={active ? "page" : undefined}
            title="Save first"
            className={cn(className, "pointer-events-none opacity-50")}
          >
            {LANG_SHORT[lang]}
          </span>
        ) : (
          <Link
            key={lang}
            href={hrefs[lang]}
            aria-label={EDIT_LABEL[lang]}
            aria-current={active ? "page" : undefined}
            className={className}
          >
            {LANG_SHORT[lang]}
          </Link>
        );
      })}
    </nav>
  );
}
