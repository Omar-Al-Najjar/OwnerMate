import type {
  DashboardResponse,
  GenerateContentRequest,
  GenerateContentResponse,
  ReviewDetailResponse,
  ReviewsListRequest,
  ReviewsListResponse,
  SettingsResponse,
} from "@/lib/api/contracts";
import {
  generatedDraft,
  getDashboardData,
  getReviewById,
  getReviews,
  settingsProfile,
} from "@/lib/mock/data";

function success<T>(data: T) {
  return {
    status: "success" as const,
    data,
    meta: {
      source: "mock" as const,
      requestedAt: new Date().toISOString(),
    },
  };
}

export const apiClient = {
  async getDashboard(): Promise<DashboardResponse> {
    return success(getDashboardData());
  },
  async getReviews(request?: ReviewsListRequest): Promise<ReviewsListResponse> {
    const filtered = getReviews().filter((review) => {
      const queryMatch = request?.query
        ? `${review.reviewerName} ${review.reviewText}`
            .toLowerCase()
            .includes(request.query.toLowerCase())
        : true;
      const sentimentMatch =
        request?.sentiment && request.sentiment !== "all"
          ? review.sentiment.label === request.sentiment
          : true;
      const languageMatch =
        request?.language && request.language !== "all"
          ? review.language === request.language
          : true;

      return queryMatch && sentimentMatch && languageMatch;
    });

    return success({
      items: filtered,
      total: filtered.length,
    });
  },
  async getReviewById(reviewId: string): Promise<ReviewDetailResponse> {
    const review = getReviewById(reviewId);

    if (!review) {
      return {
        status: "error",
        error: {
          code: "REVIEW_NOT_FOUND",
          message: "Review not found.",
        },
        meta: {
          source: "mock",
          requestedAt: new Date().toISOString(),
        },
      };
    }

    return success(review);
  },
  async generateContent(
    request: GenerateContentRequest
  ): Promise<GenerateContentResponse> {
    return success({
      ...generatedDraft,
      language: request.language,
      mode: request.mode,
    });
  },
  async getSettings(): Promise<SettingsResponse> {
    return success(settingsProfile);
  },
};
