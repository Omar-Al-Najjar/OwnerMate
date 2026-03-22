import { SectionHeader } from "@/components/common/section-header";
import { ReviewsWorkspace } from "@/components/reviews/reviews-workspace";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getReviews } from "@/lib/mock/data";
import type { LocaleParams } from "@/types/i18n";

export default async function ReviewsPage({ params }: LocaleParams) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const dictionary = getDictionary(safeLocale);

  return (
    <section className="space-y-8">
      <SectionHeader
        description={dictionary.reviews.description}
        eyebrow={dictionary.navigation.reviews}
        title={dictionary.reviews.title}
      />
      <ReviewsWorkspace
        dictionary={dictionary}
        locale={safeLocale}
        reviews={getReviews()}
      />
    </section>
  );
}
