import { SectionHeader } from "@/components/common/section-header";
import { ContentWorkspace } from "@/components/content/content-workspace";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { LocaleParams } from "@/types/i18n";

export default async function AiContentPage({ params }: LocaleParams) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const dictionary = getDictionary(safeLocale);

  return (
    <section className="space-y-8">
      <SectionHeader
        description={dictionary.aiContent.description}
        eyebrow={dictionary.navigation.aiContent}
        title={dictionary.aiContent.title}
      />
      <ContentWorkspace dictionary={dictionary} locale={safeLocale} />
    </section>
  );
}
