import { currentLang } from "@/lib/locale-server";
import type { Lang } from "@/lib/locale";

/**
 * The boundary the three public `notFound()` calls resolve to —
 * `plant/[slug]`, `pod/[slug]` and `bean/[id]`. It renders INSIDE
 * `(chrome)/layout.tsx`, so the mark, the nav, the language switch and the
 * measure are already there and this file adds none of them.
 *
 * Bilingual, unlike `app/not-found.tsx`, for the reason that file states: this
 * one sits inside the language-aware zone and `currentLang()` is one call away.
 *
 * `COPY` is exported and the presentational half is split into `NotFoundCopy`
 * so both can be tested directly against an explicit `lang`, without going
 * through `currentLang()` — which reads real request cookies and throws
 * outside one. `lib/error-pages.test.tsx` uses this to pin the fr lookup and
 * the shape (no `<main>`, no `max-w-3xl` — both belong to the layout).
 */
export const COPY = {
  en: {
    title: "Not here",
    body: "This page does not exist, or it is not public yet.",
    home: "Back to the garden",
  },
  fr: {
    title: "Rien ici",
    body: "Cette page n'existe pas, ou n'est pas encore publique.",
    home: "Retour au jardin",
  },
} satisfies Record<Lang, { title: string; body: string; home: string }>;

export function NotFoundCopy({ lang }: { lang: Lang }) {
  const copy = COPY[lang];
  return (
    <div>
      <h1 className="font-heading text-2xl">{copy.title}</h1>
      <p className="mt-3 text-muted-foreground">{copy.body}</p>
      <p className="mt-8">
        <a href="/" className="underline underline-offset-4">
          {copy.home}
        </a>
      </p>
    </div>
  );
}

export default async function ChromeNotFound() {
  const lang = await currentLang();
  return <NotFoundCopy lang={lang} />;
}
