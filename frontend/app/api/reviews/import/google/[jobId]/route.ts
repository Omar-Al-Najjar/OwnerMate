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

export async function GET(
  _: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const headers = await getAuthenticatedBackendHeaders();
    const { jobId } = await context.params;
    const result = await fetchBackendJson<GoogleImportJobResponse>(
      `/reviews/import/google/${jobId}`,
      {
        headers,
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
          message: "Google review import status lookup failed.",
        },
      },
      { status: 500 }
    );
  }
}
