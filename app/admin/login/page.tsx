import { loginAction } from "../actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

/**
 * The one admin route `middleware.ts` lets through unauthenticated — and
 * therefore the one that must sit OUTSIDE `app/admin/(chrome)/`, whose layout
 * reads the garden to compose the plant switcher's marks.
 *
 * That is why this page draws its own `<main>` instead of receiving one from
 * `AdminMain`. There is deliberately no layout between `app/layout.tsx` and
 * this file: a layout here would be an empty-looking place to add a read, and
 * the read is the thing that leaks. `AdminChrome` is a client island, so a prop
 * handed to it crosses into the flight payload — inlined in the HTML — before
 * the component gets the chance to decline to render, which is how the old
 * arrangement published every plant, logo URL and visibility to anonymous
 * visitors while showing them nothing but this card.
 * `lib/admin-login-layout-source.test.ts` keeps it that way.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg tracking-tight">Ariko admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={loginAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" name="password" required autoFocus />
            </div>
            {error ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>Incorrect password.</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit">Log in</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
