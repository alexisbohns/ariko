import { type Seed, resolveText } from "@/lib/data";
import { listSeeds } from "@/lib/seeds";
import { createSeedAction } from "./actions";
import { AdminBar } from "./_components/admin-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceLabel, NativeRadio } from "@/components/ui/native-controls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

function noteSnippet(body: Seed["body"]): string {
  const text = body?.en || body?.fr || "";
  if (!text) return "—";
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

function mediaLabel(media: Seed["media"]): string {
  if (media.length === 0) return "—";
  if (media.length === 1) return `1 ${media[0].kind}`;
  return `${media.length} items`;
}

function ageLabel(createdAt: string, now: number): string {
  const then = Date.parse(createdAt);
  if (Number.isNaN(then)) return "—";
  const secs = Math.max(0, Math.round((now - then) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  let seeds: Seed[] | null = null;
  try {
    seeds = await listSeeds({ status: "inbox" });
  } catch {
    seeds = null; // rendered as a load-failure line below
  }

  const now = Date.now();

  return (
    <article>
      <AdminBar current="/admin" />

      <div className="flex flex-col gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg tracking-tight">Seed</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <Alert variant="destructive" role="alert" className="mb-4">
                <AlertDescription>Could not save: {error}</AlertDescription>
              </Alert>
            ) : null}
            <form action={createSeedAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="seed-title">Title</Label>
                <Input id="seed-title" type="text" name="title" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="seed-note">Note</Label>
                <Textarea id="seed-note" name="note" rows={2} />
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">Note language</legend>
                <div className="flex items-center gap-4 pt-1">
                  <ChoiceLabel>
                    <NativeRadio name="lang" value="en" defaultChecked /> en
                  </ChoiceLabel>
                  <ChoiceLabel>
                    <NativeRadio name="lang" value="fr" /> fr
                  </ChoiceLabel>
                </div>
              </fieldset>
              <div className="flex flex-col gap-2">
                <Label htmlFor="seed-link-1">Link</Label>
                <Input id="seed-link-1" type="url" name="link" placeholder="paste a URL" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="seed-link-2">Link</Label>
                <Input
                  id="seed-link-2"
                  type="url"
                  name="link"
                  placeholder="another URL (optional)"
                />
              </div>
              <div>
                <Button type="submit">Add to inbox</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg tracking-tight">
            Inbox{" "}
            {seeds ? <span className="text-muted-foreground">({seeds.length})</span> : null}
          </h2>
          {seeds === null ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>Couldn&apos;t load the inbox.</AlertDescription>
            </Alert>
          ) : seeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inbox empty.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>source</TableHead>
                  <TableHead>title</TableHead>
                  <TableHead>note</TableHead>
                  <TableHead>media</TableHead>
                  <TableHead>age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seeds.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-muted-foreground">{c.source.kind}</TableCell>
                    <TableCell>
                      <a
                        href={`/admin/triage/${c.id}`}
                        className="underline-offset-4 transition-colors hover:underline"
                      >
                        {resolveText(c.title)}
                      </a>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{noteSnippet(c.body)}</TableCell>
                    <TableCell className="text-muted-foreground">{mediaLabel(c.media)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {ageLabel(c.createdAt, now)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </article>
  );
}
