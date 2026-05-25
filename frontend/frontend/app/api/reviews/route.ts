import { NextResponse } from "next/server";
import { toFrontendReviewListItem } from "@/lib/api/adapters";
import {
  BackendRouteError,
  fetchBackendJson,
  getBackendAuthContext,
} from "@/lib/api/server";

type BackendReviewListItemRead = {
  id: string;
  business_id: string;
  source_type: string;
  reviewer_name: string | null;
  rating: number | null;
  language: string | null;
  review_text: string;
  review_created_at: string | null;
  status: "pending" | "reviewed" | "responded";
  sentiment?: {
    label: "positive" | "neutral" | "negative";
  } | null;
};

type BackendReviewsListPayload = {
  items: BackendReviewListItemRead[];
  total: number;
  limit: number;
  offset: number;
  source_types: string[];
};

function firstSearchValue(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key);
  return value && value !== "all" ? value : null;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const { businessId, headers } = await getBackendAuthContext();

    if (!businessId) {
      throw new BackendRouteError(
        "BUSINESS_NOT_FOUND",
        "No business is available for the authenticated user.",
        404
      );
    }

    const pageSize = Math.max(
      1,
      Number(requestUrl.searchParams.get("pageSize") ?? "10") || 10
    );
    const page = Math.max(
      1,
      Number(requestUrl.searchParams.get("page") ?? "1") || 1
    );
    const backendQuery = new URLSearchParams({
      business_id: businessId,
      limit: String(pageSize),
      offset: String((page - 1) * pageSize),
    });

    const query = requestUrl.searchParams.get("q");
    if (query) {
      backendQuery.set("search_text", query);
    }

    const sentiment = firstSearchValue(requestUrl.searchParams, "sentiment");
    if (sentiment) {
      backendQuery.set("sentiment_label", sentiment);
    }

    const language = firstSearchValue(requestUrl.searchParams, "language");
    if (language) {
      backendQuery.set("language", language);
    }

    const source = firstSearchValue(requestUrl.searchParams, "source");
    if (source) {
      backendQuery.set("source_type", source);
    }

    const rating = firstSearchValue(requestUrl.searchParams, "rating");
    if (rating) {
      backendQuery.set("min_rating", rating);
      backendQuery.set("max_rating", rating);
    }

    if (requestUrl.searchParams.get("date") === "oldest") {
      backendQuery.set("date_order", "oldest");
    }

    const reviewsResponse = await fetchBackendJson<BackendReviewsListPayload>(
      `/reviews?${backendQuery.toString()}`,
      { headers }
    );
    const totalPages = Math.max(1, Math.ceil(reviewsResponse.total / pageSize));

    return NextResponse.json({
      success: true,
      data: {
        items: reviewsResponse.items.map((review) =>
          toFrontendReviewListItem(review, review.sentiment ?? null)
        ),
        total: reviewsResponse.total,
        page: Math.min(page, totalPages),
        pageSize,
        totalPages,
        sourceOptions: reviewsResponse.source_types,
      },
    });
  } catch (error) {
    if (error instanceof BackendRouteError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load reviews.",
        },
      },
      { status: 500 }
    );
  }
}
