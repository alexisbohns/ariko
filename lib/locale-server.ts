import { cookies } from "next/headers";
import { LANG_COOKIE, resolveLang, type Lang } from "./locale";

// The server-side read of the stored preference. Kept OUT of lib/locale.ts so
// that file stays pure and edge-safe — the middleware imports it, and pure
// functions are what the tests exercise.
//
// The `?lang=` param is not consulted here: the middleware has already turned
// it into a cookie and redirected, so by the time a page renders, the cookie is
// the whole truth.
export async function currentLang(): Promise<Lang> {
  return resolveLang(undefined, (await cookies()).get(LANG_COOKIE)?.value);
}
