import { currentLang } from "@/lib/locale-server";

/**
 * The boundary the three public `notFound()` calls resolve to —
 * `plant/[slug]`, `pod/[slug]` and `bean/[id]`. It renders INSIDE
 * `(chrome)/layout.tsx`, so the mark, the nav, the language switch and the
 * measure are already there and this file adds none of them.
 *
 * Bilingual, unlike `app/not-found.tsx`, for the reason that file states: this
 * one sits inside the language-aware zone and `currentLang()` is one call away.
 */
const COPY = {
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
} as const;

export default async function ChromeNotFound() {
  const copy = COPY[await currentLang()];
  return (
    <div>
      <h1 className="font-mono text-2xl">{copy.title}</h1>
      <p className="mt-3 text-muted-foreground">{copy.body}</p>
      <p className="mt-8">
        <a href="/" className="underline underline-offset-4">
          {copy.home}
        </a>
      </p>
    </div>
  );
}
