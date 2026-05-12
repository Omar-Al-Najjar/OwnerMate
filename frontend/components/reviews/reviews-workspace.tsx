"use client";

import type { Route } from "next";
import { startTransition, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatSourceLabel } from "@/lib/api/adapters";
import { Button } from "@/components/forms/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ReviewFilters } from "@/components/reviews/review-filters";
import { ReviewTable } from "@/components/reviews/review-table";
import type { ReviewListItem } from "@/types/review";

type ReviewFiltersState = {
  query: string;
  sentiment: string;
  language: string;
  source: string;
  rating: string;
  date: string;
};

type ReviewsWorkspaceProps = {
  locale: string;
  reviews: ReviewListItem[];
  totalResults: number;
  totalPages: number;
  currentPage: number;
  sourceOptions: string[];
  filters: ReviewFiltersState;
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

function serializeFilters(filters: ReviewFiltersState) {
  return JSON.stringify(filters);
}

export function ReviewsWorkspace({
  locale,
  reviews,
  totalResults,
  totalPages,
  currentPage,
  sourceOptions,
  filters: initialFilters,
  dictionary,
}: ReviewsWorkspaceProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ReviewFiltersState>(initialFilters);
  const [page, setPage] = useState(currentPage);
  const [debouncedQuery, setDebouncedQuery] = useState(initialFilters.query);
  const [requestState] = useState<ReviewsState>("ready");

  useEffect(() => {
    setFilters((current) =>
      serializeFilters(initialFilters) !== serializeFilters(current)
        ? initialFilters
        : current
    );
    setPage((current) => (currentPage !== current ? currentPage : current));
    setDebouncedQuery((current) =>
      initialFilters.query !== current ? initialFilters.query : current
    );
  }, [currentPage, initialFilters, pathname, searchParams]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(filters.query);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [filters.query]);

  useEffect(() => {
    const nextSearchParams = new URLSearchParams();

    if (debouncedQuery) {
      nextSearchParams.set("q", debouncedQuery);
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
    const currentSearch = searchParams.toString();
    const currentUrl = currentSearch ? `${pathname}?${currentSearch}` : pathname;

    if (nextUrl !== currentUrl) {
      startTransition(() => {
        router.replace(nextUrl as Route, { scroll: false });
      });
    }
  }, [
    debouncedQuery,
    filters.date,
    filters.language,
    filters.rating,
    filters.sentiment,
    filters.source,
    page,
    pathname,
    router,
    searchParams,
  ]);

  const safePage = Math.min(page, totalPages);
  const sourceFilterOptions = useMemo(
    () =>
      sourceOptions.map((source) => ({
        label: formatSourceLabel(source),
        value: source,
      })),
    [sourceOptions]
  );
  const activeFilterCount = [
    filters.query,
    filters.sentiment !== "all" ? filters.sentiment : "",
    filters.language !== "all" ? filters.language : "",
    filters.source !== "all" ? filters.source : "",
    filters.rating !== "all" ? filters.rating : "",
    filters.date !== "newest" ? filters.date : "",
  ].filter(Boolean).length;
  const visibleResultsCount = reviews.length;

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

  const paginationPages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="space-y-6">
      <div className="soft-panel overflow-hidden p-4 sm:p-5">
        <div className="absolute -right-12 top-0 h-28 w-28 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-start">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                {dictionary.reviews.filtersTitle}
              </p>
              <p className="mt-2 text-sm text-foreground">
                {dictionary.common.showing} {totalResults} {dictionary.common.results}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
              <span className="inline-flex items-center rounded-full border border-border/70 bg-background/72 px-3 py-1.5">
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

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/72 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
                {dictionary.common.showing}
              </p>
              <p className="metric-value mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                {visibleResultsCount}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/72 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
                {dictionary.common.results}
              </p>
              <p className="metric-value mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                {totalResults}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/72 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
                {dictionary.reviews.pageLabel}
              </p>
              <p className="metric-value mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                {safePage}/{totalPages}
              </p>
            </div>
          </div>
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
            ...sourceFilterOptions,
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

        {requestState === "ready" && totalResults === 0 ? (
          <EmptyState
            description={dictionary.reviews.noResultsDescription}
            title={dictionary.reviews.noResultsTitle}
          />
        ) : null}

        {requestState === "ready" && totalResults > 0 ? (
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
              reviews={reviews}
            />

            {totalPages > 1 ? (
              <div className="soft-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
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
                        className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl border px-3 text-sm font-semibold transition ${
                          isActive
                            ? "border-primary bg-gradient-to-br from-primary to-primary-container text-primary-foreground shadow-sm dark:text-card"
                            : "border-border/70 bg-card text-foreground hover:-translate-y-px hover:bg-surface-low"
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
