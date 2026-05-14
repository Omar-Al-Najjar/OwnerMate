import { SectionHeader } from "@/components/common/section-header";
import { DatasetAnalysisWorkspace } from "@/components/dataset-analysis/dataset-analysis-workspace";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { LocaleParams } from "@/types/i18n";

export default async function DatasetAnalysisPage({ params }: LocaleParams) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const dictionary = getDictionary(safeLocale);

  return (
    <section className="space-y-8">
      <SectionHeader
        description={dictionary.datasetAnalysis.description}
        eyebrow={dictionary.navigation.datasetAnalysis}
        title={dictionary.datasetAnalysis.title}
      />
      <DatasetAnalysisWorkspace dictionary={dictionary} locale={safeLocale} />
    </section>
  );
}
