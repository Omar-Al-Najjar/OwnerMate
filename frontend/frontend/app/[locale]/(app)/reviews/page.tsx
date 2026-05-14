import { SectionHeader } from "@/components/common/section-header";
import { ErrorState } from "@/components/feedback/error-state";
import { ReviewsWorkspace } from "@/components/reviews/reviews-workspace";
import { apiClient } from "@/lib/api/client";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { LocaleParams } from "@/types/i18n";

const DEFAULT_REVIEWS_PAGE_SIZE = 10;

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function ReviewsPage({
  params,
  searchParams,
}: LocaleParams & {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const safeLocale = resolveLocale(locale);
  const dictionary = getDictionary(safeLocale);
  const pageParam = Number(firstString(resolvedSearchParams.page) ?? "1");
  const reviewsResponse = await apiClient.getReviews({
    query: firstString(resolvedSearchParams.q) ?? undefined,
    sentiment: (firstString(resolvedSearchParams.sentiment) as
      | "positive"
      | "neutral"
      | "negative"
      | "all"
      | undefined) ?? "all",
    language: (firstString(resolvedSearchParams.language) as
      | "en"
      | "ar"
      | "all"
      | undefined) ?? "all",
    source: firstString(resolvedSearchParams.source) ?? "all",
    rating: firstString(resolvedSearchParams.rating) ?? "all",
    date:
      firstString(resolvedSearchParams.date) === "oldest" ? "oldest" : "newest",
    page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
    pageSize: DEFAULT_REVIEWS_PAGE_SIZE,
  });

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
        currentPage={reviewsResponse.data?.page ?? 1}
        filters={{
          query: firstString(resolvedSearchParams.q) ?? "",
          sentiment: firstString(resolvedSearchParams.sentiment) ?? "all",
          language: firstString(resolvedSearchParams.language) ?? "all",
          source: firstString(resolvedSearchParams.source) ?? "all",
          rating: firstString(resolvedSearchParams.rating) ?? "all",
          date: firstString(resolvedSearchParams.date) === "oldest" ? "oldest" : "newest",
        }}
        reviews={reviewsResponse.data?.items ?? []}
        sourceOptions={reviewsResponse.data?.sourceOptions ?? []}
        totalPages={reviewsResponse.data?.totalPages ?? 1}
        totalResults={reviewsResponse.data?.total ?? 0}
      />
    </section>
  );
}
