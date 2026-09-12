/**
 * The welcome page's one line. Pure so the boundaries are testable — a
 * greeting computed inline in a server component is a string nobody can assert
 * on, and the boundaries are the only thing about it worth asserting.
 *
 * Server-rendered, so it reads the SERVER's clock. That is a deliberate
 * shrug: the alternative is an island whose only job is to know the hour, and
 * this page has better islands to spend.
 */
export function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
