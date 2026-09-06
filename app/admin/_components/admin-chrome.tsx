"use client";

import { usePathname } from "next/navigation";
import { Archive, ExternalLink, Inbox, LogOut, Sprout, Waypoints } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { NAV_ITEMS, resolveNavItem } from "@/lib/admin-nav";
import { logoutAction } from "../actions";
import { CommandPalette } from "./command-palette";
import { CHROME_PLATE } from "@/components/chrome-plate";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * The admin's chrome, rendered once by the layout rather than by each page —
 * which is why the `current` prop the old AdminBar took is gone: the active
 * item comes from the pathname (lib/admin-nav.ts).
 *
 * Chrome, not a form: every nav item is a plain <a href> and Log out is still
 * a real <form> with a real submit button, so the zero-client-JS rule in
 * CLAUDE.md is untouched here. (The seed overlay is where this slice spends
 * its exception.)
 *
 * The spacing that clears the chrome lives here too, in AdminMain, because the
 * decision is the same decision: a page with no chrome must not be padded as
 * though it had some. One route constant, two consumers.
 */

/** The one route the chrome withdraws from — and therefore the one route the
 *  content column is centred rather than offset on. */
const BARE = "/admin/login";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "/admin": Inbox,
  "/admin/vault": Archive,
  "/admin/garden": Sprout,
  "/admin/beanstalk": Waypoints,
};

export function AdminChrome() {
  const pathname = usePathname();

  // The login page lives under /admin but gets no chrome. Under the old bar
  // this was expressed by the page simply not calling it; the layout owns the
  // chrome now, so it is expressed here.
  if (pathname === BARE) return null;

  const active = resolveNavItem(pathname);

  return (
    <TooltipProvider>
      <nav
        aria-label="Admin sections"
        className={`fixed left-4 top-1/2 z-40 -translate-y-1/2 rounded-2xl p-1.5 ${CHROME_PLATE}`}
      >
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.href];
            const isActive = item.href === active;
            return (
              <li key={item.href}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <a
                        href={item.href}
                        aria-label={item.label}
                        aria-current={isActive ? "page" : undefined}
                        className={
                          "flex size-9 items-center justify-center rounded-xl transition-colors " +
                          (isActive
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
                        }
                      >
                        <Icon className="size-4" />
                      </a>
                    }
                  />
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* The account cluster had no plate at all — three bare icons over
          the page. It wears the same one as the rail now, which is what
          makes the two read as one chrome rather than as a furnished rail
          and some loose buttons. Ghost at rest, so the cost is nothing. */}
      <div
        className={`fixed right-4 top-4 z-40 flex items-center gap-1 rounded-2xl p-1.5 ${CHROME_PLATE}`}
      >
        {/* The palette rides with the chrome rather than the page: rendered
            here, it is behind the same login-page withdrawal above — one route
            constant, now three consumers — and ⌘K works on every admin route
            without a page having to opt in. It is still an island: it fetches
            nothing until it is opened. */}
        <CommandPalette />

        <Tooltip>
          <TooltipTrigger
            render={
              <a
                href="/"
                aria-label="Public site"
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              >
                <ExternalLink className="size-4" />
              </a>
            }
          />
          <TooltipContent side="bottom">Public site</TooltipContent>
        </Tooltip>

        <form action={logoutAction}>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button type="submit" size="icon" variant="ghost" aria-label="Log out">
                  <LogOut className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Log out</TooltipContent>
          </Tooltip>
        </form>
      </div>
    </TooltipProvider>
  );
}

/**
 * The content column. A client component only so it can read the pathname: the
 * layout is a server component and cannot, and without that the login card sat
 * centred inside an off-centre box — padded on both sides for a rail and an
 * account cluster that AdminChrome had already withdrawn.
 *
 * `pr-36` is measured, not chosen. The top-right cluster is THREE `size-8`
 * buttons (palette, public site, log out) at `gap-1`, inside the chrome plate's
 * `p-1.5`, offset by `right-4`:
 *
 *     3*32 + 2*4 + 2*6 + 16 = 132px
 *
 * `pr-36` (144px) clears that with 12px to spare. Two earlier values did not,
 * and the failure mode is the same each time: the column's right edge slides
 * under a fixed element that wins every hit test, swallowing the tail of the
 * right-aligned link on /admin/beanstalk. `pr-16` (64px) was the first to do
 * it. Its replacement was ALSO short — by 24px once the palette became the
 * cluster's third button, and by 36px once the cluster gained the plate's
 * padding — it simply went unnoticed because the overlap landed on whitespace
 * on most pages.
 *
 * If a fourth button is ever added here, recompute. Do not nudge.
 */
export function AdminMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === BARE;
  return (
    <main className={"mx-auto max-w-5xl py-8 " + (bare ? "px-6" : "pl-20 pr-36")}>{children}</main>
  );
}
