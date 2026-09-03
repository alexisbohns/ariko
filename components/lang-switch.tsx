import { LANG_PARAM, LANG_SHORT, LANG_LABEL, otherLang, type Lang } from "@/lib/locale";

/**
 * The public zone's language switch (#53).
 *
 * A single anchor to `?lang=<other>`, which the middleware turns into a cookie
 * and redirects away. No client JS, no form, no state — which is what lets the
 * public zone keep working with scripting off.
 *
 * It links to the CURRENT path so switching language keeps you on the page you
 * are reading. The href is a bare query string, resolved by the browser against
 * the current URL, so this component never has to know the path it sits on —
 * and never interpolates one.
 */
export function LangSwitch({ lang }: { lang: Lang }) {
  const target = otherLang(lang);
  return (
    <a
      href={`?${LANG_PARAM}=${target}`}
      hrefLang={target}
      lang={target}
      aria-label={`Read this page in ${LANG_LABEL[target]}`}
      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      {LANG_SHORT[target]}
    </a>
  );
}
