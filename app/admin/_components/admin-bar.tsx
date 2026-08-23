import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { logoutAction } from "../actions";

const LINKS = [
  { href: "/admin", label: "Inbox" },
  { href: "/admin/vault", label: "Vault" },
  { href: "/admin/garden", label: "Garden" },
  { href: "/admin/beanstalk", label: "Beanstalk" },
];

/**
 * The authenticated admin's top bar. Rendered by each page rather than the
 * layout so the login page — which lives under `/admin` too — stays bare.
 */
export function AdminBar({ current }: { current?: string }) {
  return (
    <div className="mb-8 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-heading text-sm font-medium tracking-tight">ariko admin</span>
        <nav>
          <ul className="flex items-center gap-3 text-sm text-muted-foreground">
            {LINKS.map((link) => (
              <li key={link.href}>
                {link.href === current ? (
                  <span className="text-foreground">{link.label}</span>
                ) : (
                  <a href={link.href} className="transition-colors hover:text-foreground">
                    {link.label}
                  </a>
                )}
              </li>
            ))}
            <li>
              <a href="/" className="transition-colors hover:text-foreground">
                Public site ↗
              </a>
            </li>
          </ul>
        </nav>
        <form action={logoutAction} className="ml-auto">
          <Button type="submit" variant="ghost" size="sm">
            Log out
          </Button>
        </form>
      </div>
      <Separator />
    </div>
  );
}
