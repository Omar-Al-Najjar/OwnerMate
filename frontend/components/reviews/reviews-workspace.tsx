"use client";

import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/forms/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ReviewFilters } from "@/components/reviews/review-filters";
import { ReviewTable } from "@/components/reviews/review-table";
import type { Review } from "@/types/review";

type ReviewsWorkspaceProps = {
  locale: string;
  reviews: Review[];
  dictionary: {
    common: {
      all: string;
      clear: string;
      language: string;
      rating: string;
      search: string;
      source: string;
      sentiment: string;
      showing: string;
      of: string;
      results: string;
      reviewer: string;
      reviewText: string;
      date: string;
    };
    reviews: {
      searchPlaceholder: string;
      sentimentFilter: string;
      languageFilter: string;
      sourceFilter: string;
      ratingFilter: string;
      dateFilter: string;
      allSources: string;
      allRatings: string;
      newest: string;
      oldest: string;
      noResultsTitle: string;
      noResultsDescription: string;
      loadingTitle: string;
      loadingDescription: string;
      errorTitle: string;
      errorDescription: string;
      listTitle: string;
      openReview: string;
      filtersTitle: string;
      activeFilters: string;
      previousPage: string;
      nextPage: string;
      pageLabel: string;
    };
    languageNames: {
      en: string;
      ar: string;
    };
    sentimentLabels: {
      positive: string;
      neutral: string;
      negative: string;
    };
  };
};

type ReviewsState = "ready" | "error";

type ReviewFiltersState = {
  query: string;
  sentiment: string;
  language: string;
  source: string;
  rating: string;
  date: string;
};

const PAGE_SIZE = 6;

function getDefaultFilters(): ReviewFiltersState {
  return {
    query: "",
    sentiment: "all",
    language: "all",
    source: "all",
    rating: "all",
    date: "newest",
  };
}

function getFiltersFromSearchParams(searchParams: URLSearchParams) {
  return {
    query: searchParams.get("q") ?? "",
    sentiment: searchParams.get("sentiment") ?? "all",
    language: searchParams.get("language") ?? "all",
    source: searchParams.get("source") ?? "all",
    rating: searchParams.get("rating") ?? "all",
    date: searchParams.get("date") ?? "newest",
  };
}

function getPageFromSearchParams(searchParams: URLSearchParams) {
  const pageParam = Number(searchParams.get("page") ?? "1");
  return Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
}

function serializeFilters(filters: ReviewFiltersState) {
  return JSON.stringify(filters);
}

export function ReviewsWorkspace({
  locale,
  reviews,
  dictionary,
}: ReviewsWorkspaceProps) {
  const pathname = usePathname();
  const [filters, setFilters] = useState<ReviewFiltersState>(getDefaultFilters);
  const [page, setPage] = useState(1);
  const [requestState] = useState<ReviewsState>("ready");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const nextFilters = getFiltersFromSearchParams(searchParams);
    const nextPage = getPageFromSearchParams(searchParams);

    setFilters((current) =>
      serializeFilters(nextFilters) !== serializeFilters(current)
        ? nextFilters
        : current
    );
    setPage((current) => (nextPage !== current ? nextPage : current));
  }, [pathname]);

  useEffect(() => {
    const nextSearchParams = new URLSearchParams();

    if (filters.query) {
      nextSearchParams.set("q", filters.query);
    }
    if (filters.sentiment !== "all") {
      nextSearchParams.set("sentiment", filters.sentiment);
    }
    if (filters.language !== "all") {
      nextSearchParams.set("language", filters.language);
    }
    if (filters.source !== "all") {
      nextSearchParams.set("source", filters.source);
    }
    if (filters.rating !== "all") {
      nextSearchParams.set("rating", filters.rating);
    }
    if (filters.date !== "newest") {
      nextSearchParams.set("date", filters.date);
    }
    if (page > 1) {
      nextSearchParams.set("page", String(page));
    }

    const nextUrl = nextSearchParams.toString()
      ? `${pathname}?${nextSearchParams.toString()}`
      : pathname;
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl as Route);
    }
  }, [filters, page, pathname]);

  const filteredReviews = useMemo(() => {
    const items = reviews.filter((review) => {
      const queryMatch = filters.query
        ? `${review.reviewerName} ${review.reviewText}`
            .toLowerCase()
            .includes(filters.query.toLowerCase())
        : true;
      const sentimentMatch =
        filters.sentiment === "all" ||
        review.sentiment.label === filters.sentiment;
      const languageMatch =
        filters.language === "all" || review.language === filters.language;
      const sourceMatch =
        filters.source === "all" || review.source === filters.source;
      const ratingMatch =
        filters.rating === "all" || review.rating === Number(filters.rating);

      return (
        queryMatch &&
        sentimentMatch &&
        languageMatch &&
        sourceMatch &&
        ratingMatch
      );
    });

    return [...items].sort((left, right) => {
      return filters.date === "oldest"
        ? new Date(left.reviewCreatedAt).getTime() -
            new Date(right.reviewCreatedAt).getTime()
        : new Date(right.reviewCreatedAt).getTime() -
            new Date(left.reviewCreatedAt).getTime();
    });
  }, [filters, reviews]);

  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const paginatedReviews = filteredReviews.slice(pageStart, pageEnd);
  const sourceOptions = Array.from(
    new Set(reviews.map((review) => review.source))
  ).map((source) => ({
    label: source,
    value: source,
  }));
  const activeFilterCount = [
    filters.query,
    filters.sentiment !== "all" ? filters.sentiment : "",
    filters.language !== "all" ? filters.language : "",
    filters.source !== "all" ? filters.source : "",
    filters.rating !== "all" ? filters.rating : "",
    filters.date !== "newest" ? filters.date : "",
  ].filter(Boolean).length;

  const labels = {
    sentiment: dictionary.sentimentLabels,
    language: dictionary.languageNames,
  };

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const handleFilterChange = (name: string, value: string) => {
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
    setPage(1);
  };

  const paginationPages = Array.from(
    { length: totalPages },
    (_, index) => index + 1
  );

  return (
    <div className="space-y-6">
      <div className="soft-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-start">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
            {dictionary.reviews.filtersTitle}
          </p>
          <p className="mt-2 text-sm text-foreground">
            {dictionary.common.showing} {filteredReviews.length}{" "}
            {dictionary.common.results}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>
            {dictionary.reviews.activeFilters}: {activeFilterCount}
          </span>
          <Button
            variant="secondary"
            disabled={activeFilterCount === 0}
            onClick={() => {
              setFilters(getDefaultFilters());
              setPage(1);
            }}
            type="button"
          >
            {dictionary.common.clear}
          </Button>
        </div>
      </div>

      <ReviewFilters
        labels={{
          search: dictionary.common.search,
          searchPlaceholder: dictionary.reviews.searchPlaceholder,
          sentiment: dictionary.reviews.sentimentFilter,
          language: dictionary.reviews.languageFilter,
          source: dictionary.reviews.sourceFilter,
          rating: dictionary.reviews.ratingFilter,
          date: dictionary.reviews.dateFilter,
        }}
        onChange={handleFilterChange}
        options={{
          sentiment: [
            { label: dictionary.common.all, value: "all" },
            { label: dictionary.sentimentLabels.positive, value: "positive" },
            { label: dictionary.sentimentLabels.neutral, value: "neutral" },
            { label: dictionary.sentimentLabels.negative, value: "negative" },
          ],
          language: [
            { label: dictionary.common.all, value: "all" },
            { label: dictionary.languageNames.en, value: "en" },
            { label: dictionary.languageNames.ar, value: "ar" },
          ],
          source: [
            { label: dictionary.reviews.allSources, value: "all" },
            ...sourceOptions,
          ],
          rating: [
            { label: dictionary.reviews.allRatings, value: "all" },
            { label: "5", value: "5" },
            { label: "4", value: "4" },
            { label: "3", value: "3" },
            { label: "2", value: "2" },
            { label: "1", value: "1" },
          ],
          date: [
            { label: dictionary.reviews.newest, value: "newest" },
            { label: dictionary.reviews.oldest, value: "oldest" },
          ],
        }}
        values={filters}
      />

      <section className="space-y-4">
        <h2 className="text-start font-display text-2xl font-bold tracking-[-0.045em] text-foreground">
          {dictionary.reviews.listTitle}
        </h2>

        {requestState === "error" ? (
          <ErrorState
            description={dictionary.reviews.errorDescription}
            title={dictionary.reviews.errorTitle}
          />
        ) : null}

        {requestState === "ready" && filteredReviews.length === 0 ? (
          <EmptyState
            description={dictionary.reviews.noResultsDescription}
            title={dictionary.reviews.noResultsTitle}
          />
        ) : null}

        {requestState === "ready" && filteredReviews.length > 0 ? (
          <>
            <ReviewTable
              columns={{
                reviewer: dictionary.common.reviewer,
                sentiment: dictionary.common.sentiment,
                rating: dictionary.common.rating,
                date: dictionary.common.date,
                reviewText: dictionary.common.reviewText,
              }}
              detailLabel={dictionary.reviews.openReview}
              labels={labels}
              locale={locale}
              reviews={paginatedReviews}
            />

            {totalPages > 1 ? (
              <div className="soft-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  variant="secondary"
                  disabled={safePage === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                  {dictionary.reviews.previousPage}
                </Button>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  {paginationPages.map((pageNumber) => {
                    const isActive = pageNumber === safePage;

                    return (
                      <button
                        key={pageNumber}
                        className={`inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition ${
                          isActive
                            ? "border-primary bg-gradient-to-br from-sidebar to-primary-container text-white"
                            : "border-border/70 bg-card text-foreground hover:bg-surface-low"
                        }`}
                        onClick={() => setPage(pageNumber)}
                        type="button"
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end gap-3">
                  <span className="text-sm text-muted">
                    {dictionary.reviews.pageLabel} {safePage} / {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={safePage === totalPages}
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                    type="button"
                  >
                    {dictionary.reviews.nextPage}
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
