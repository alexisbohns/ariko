import { loginAction } from "../actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <article className="mx-auto max-w-sm py-12">
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
    </article>
  );
}
