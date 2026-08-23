import { textPart, type RawGarden, type Text } from "@/lib/data";
import { entityOptions } from "@/lib/entity-options";
import { ProseEditor } from "@/components/editor/prose-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The editor in its card. Server component: it builds the entity list from the
 * raw garden the page already loaded and hands it down as a prop, which is why
 * there is no /api/admin/entities endpoint (spec §2.7).
 *
 * `textPart(content, "en")` is STRICT on purpose — resolveText's fallback would
 * load the `fr` half into the editor and save it back as `en`, corrupting the
 * data exactly the way the name/description prefills already warn about.
 */
export function ContentCard({
  raw,
  content,
  selfRef,
  action,
  hidden,
}: {
  raw: RawGarden;
  content?: Text;
  /**
   * This entity's own ref, so the picker cannot offer it to itself — matters
   * for plant and pod pages, where entityOptions() does emit a row for the
   * page's own container. The sprout page passes `sprout:${slug}` here too,
   * for consistency, but it excludes nothing: entityOptions() never emits
   * `sprout:` rows at all (a sprout has no public URL to mint a reference
   * to), so there is nothing for that ref to filter out.
   */
  selfRef: string;
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base tracking-tight">Content</CardTitle>
      </CardHeader>
      <CardContent>
        <ProseEditor
          initialMarkdown={textPart(content, "en")}
          entities={entityOptions(raw, selfRef)}
          action={action}
          hidden={hidden}
        />
      </CardContent>
    </Card>
  );
}
