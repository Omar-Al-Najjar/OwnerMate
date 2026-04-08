import { NextResponse } from "next/server";
import {
  BackendRouteError,
  fetchBackendJson,
  getAuthenticatedBackendHeaders,
} from "@/lib/api/server";

type GoogleImportJobResponse = {
  agent_run_id: string;
  business_id: string;
  status: "queued" | "running" | "needs_selection" | "success" | "failed";
  business_name: string;
  provider_name: string;
  provider_job_id: string | null;
  provider_status: string | null;
  message: string;
  imported_count: number | null;
  duplicate_count: number | null;
  processed_count: number | null;
  candidates?: Array<{
    candidate_id: string;
    title: string;
    category: string | null;
    address: string | null;
    review_count: number | null;
    review_rating: number | null;
    place_id: string | null;
    link: string | null;
  }>;
  selected_candidate_id?: string | null;
  started_at: string | null;
  finished_at: string | null;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      businessId?: string;
      businessName?: string;
      lang?: "en" | "ar";
      depth?: number;
      limit?: number;
    };

    if (!payload.businessId) {
      throw new BackendRouteError(
        "BUSINESS_REQUIRED",
        "Business context is required for Google review import.",
        422
      );
    }

    const normalizedBusinessName =
      typeof payload.businessName === "string" ? payload.businessName.trim() : "";

    if (!normalizedBusinessName) {
      throw new BackendRouteError(
        "BUSINESS_NAME_REQUIRED",
        "Business name is required for Google review import.",
        422
      );
    }

    const headers = await getAuthenticatedBackendHeaders();
    const result = await fetchBackendJson<GoogleImportJobResponse>(
      "/reviews/import/google",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          business_id: payload.businessId,
          connection: {
            business_name: normalizedBusinessName,
            lang: payload.lang || "en",
            depth: payload.depth ?? 1,
          },
          fetch: {
            limit: payload.limit ?? 20,
          },
        }),
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        job: {
          id: result.agent_run_id,
          status: result.status,
          businessName: result.business_name,
          providerStatus: result.provider_status,
          message: result.message,
          importedCount: result.imported_count,
          duplicateCount: result.duplicate_count,
          processedCount: result.processed_count,
          candidates: result.candidates ?? [],
          selectedCandidateId: result.selected_candidate_id ?? null,
          startedAt: result.started_at,
          finishedAt: result.finished_at,
        },
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
          message: "Google review import failed.",
        },
      },
      { status: 500 }
    );
  }
}
