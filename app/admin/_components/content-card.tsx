import type { RawGarden, Text } from "@/lib/data";
import type { Lang } from "@/lib/locale";
import { editorHalves } from "@/lib/edit-lang";
import { entityOptions } from "@/lib/entity-options";
import { ProseEditor } from "@/components/editor/prose-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The editor in its card. Server component: it builds the entity list from the
 * raw garden the page already loaded and hands it down as a prop, which is why
 * there is no /api/admin/entities endpoint (spec §2.7).
 *
 * The load goes through `editorHalves`, which is STRICT on purpose —
 * resolveText's fallback would load one half into the editor and save it back
 * as the other, corrupting the data exactly the way the name/description
 * prefills already warn about.
 */
export function ContentCard({
  raw,
  content,
  selfRef,
  action,
  hidden,
  lang,
  langHrefs,
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
  /** The half being edited, from the page's `?lang=` (lib/edit-lang.ts). */
  lang: Lang;
  langHrefs: Record<Lang, string>;
}) {
  const { initialMarkdown, seed } = editorHalves(content, lang);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base tracking-tight">Content</CardTitle>
      </CardHeader>
      <CardContent>
        <ProseEditor
          key={lang}
          initialMarkdown={initialMarkdown}
          seed={seed}
          langSwitch={{ current: lang, hrefs: langHrefs }}
          entities={entityOptions(raw, selfRef)}
          action={action}
          hidden={{ ...hidden, lang }}
        />
      </CardContent>
    </Card>
  );
}
