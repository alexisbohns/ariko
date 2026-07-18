import { createHash, timingSafeEqual } from "node:crypto";

export type AuthResult = "ok" | "unauthorized" | "forbidden";

// Parse "*:tok_master,github:tok_gh" → Map<token, Set<kind>>.
// A kind of "*" means the token is accepted for any source kind.
export function parseTokens(env: string | undefined): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  if (!env) return map;
  for (const entry of env.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx <= 0) continue; // no kind or empty kind → skip
    const kind = trimmed.slice(0, idx).trim();
    const token = trimmed.slice(idx + 1).trim();
    if (!kind || !token) continue;
    const set = map.get(token) ?? new Set<string>();
    set.add(kind);
    map.set(token, set);
  }
  return map;
}

function bearer(header: string | null): string | null {
  if (!header) return null;
  const prefix = "Bearer ";
  return header.startsWith(prefix) ? header.slice(prefix.length).trim() : null;
}

// Equality via SHA-256 digests: the buffers handed to timingSafeEqual are
// always equal-length, so neither the content nor the length of the candidate
// leaks through timing.
function timingSafeEqualStr(a: string, b: string): boolean {
  const da = createHash("sha256").update(a).digest();
  const db = createHash("sha256").update(b).digest();
  return timingSafeEqual(da, db);
}

// For /api/inbox: token must exist AND be allowed for this source kind.
export function authorize(
  header: string | null,
  sourceKind: string,
  tokens: Map<string, Set<string>>,
): AuthResult {
  const token = bearer(header);
  if (!token) return "unauthorized";
  // Scan every entry without early exit: iteration count is independent of
  // where (or whether) the candidate matches.
  let matched: Set<string> | null = null;
  for (const [candidate, kinds] of tokens) {
    if (timingSafeEqualStr(token, candidate)) matched = kinds;
  }
  if (!matched) return "unauthorized";
  if (matched.has("*") || matched.has(sourceKind)) return "ok";
  return "forbidden";
}

// For /api/upload: any valid token is enough (uploads are not source-bound).
export function hasValidToken(
  header: string | null,
  tokens: Map<string, Set<string>>,
): boolean {
  const token = bearer(header);
  if (token == null) return false;
  let found = false;
  for (const [candidate] of tokens) {
    if (timingSafeEqualStr(token, candidate)) found = true;
  }
  return found;
}
