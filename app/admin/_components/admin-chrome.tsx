"use client";

import { usePathname } from "next/navigation";
import { Archive, ExternalLink, Inbox, LogOut, Sprout, Waypoints } from "lucide-react";
import type { ComponentType } from "react";
import { NAV_ITEMS, resolveNavItem } from "@/lib/admin-nav";
import { logoutAction } from "../actions";
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
 */

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
  if (pathname === "/admin/login") return null;

  const active = resolveNavItem(pathname);

  return (
    <TooltipProvider>
      <nav
        aria-label="Admin sections"
        className="fixed left-4 top-1/2 z-40 -translate-y-1/2 rounded-2xl border bg-card/80 p-1.5 shadow-lg backdrop-blur"
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

      <div className="fixed right-4 top-4 z-40 flex items-center gap-1">
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
