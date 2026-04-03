import { SectionHeader } from "@/components/common/section-header";
import { ErrorState } from "@/components/feedback/error-state";
import { ReviewsWorkspace } from "@/components/reviews/reviews-workspace";
import { apiClient } from "@/lib/api/client";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { LocaleParams } from "@/types/i18n";

export default async function ReviewsPage({ params }: LocaleParams) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const dictionary = getDictionary(safeLocale);
  const reviewsResponse = await apiClient.getReviews();

  if (reviewsResponse.status === "error") {
    return (
      <section className="space-y-8">
        <SectionHeader
          description={dictionary.reviews.description}
          eyebrow={dictionary.navigation.reviews}
          title={dictionary.reviews.title}
        />
        <ErrorState
          description={
            reviewsResponse.error?.message ?? dictionary.reviews.errorDescription
          }
          title={dictionary.reviews.errorTitle}
        />
      </section>
    );
  }

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
        reviews={reviewsResponse.data?.items ?? []}
      />
    </section>
  );
}
