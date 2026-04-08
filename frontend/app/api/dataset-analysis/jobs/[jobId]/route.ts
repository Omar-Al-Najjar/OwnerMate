import { NextResponse } from "next/server";
import { syncDatasetAnalysisAgentRun } from "@/lib/agent-runs/server";
import { getAppSession } from "@/lib/auth/session";
import { getBackendAuthContext } from "@/lib/api/server";
import {
  DatasetAnalysisServiceError,
  getDatasetAnalysisJob,
} from "@/lib/dataset-analysis/server";

async function resolveDatasetAnalysisBusinessId(initialBusinessId?: string | null) {
  if (initialBusinessId) {
    return initialBusinessId;
  }

  try {
    const authContext = await getBackendAuthContext();
    return authContext.businessId;
  } catch {
    return null;
  }
}

function normalizeJob(
  job: Awaited<ReturnType<typeof getDatasetAnalysisJob>>
) {
  return {
    jobId: job.job_id,
    status: job.status,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    fileName: job.file_name,
    datasetName: job.dataset_name ?? null,
    sourceName: job.source_name ?? null,
    ownerUserId: job.owner_user_id ?? null,
    businessId: job.business_id ?? null,
    result: (job.result as Record<string, unknown> | null | undefined) ?? null,
    error:
      (job.error as
        | {
            code?: string;
            message?: string;
            details?: string | null;
          }
        | null
        | undefined) ?? null,
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getAppSession();
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AUTHENTICATION_REQUIRED",
            message: "Authentication required.",
          },
        },
        { status: 401 }
      );
    }

    const { jobId } = await context.params;
    const requestUrl = new URL(request.url);
    const locale = requestUrl.searchParams.get("locale") === "ar" ? "ar" : "en";
    const job = await getDatasetAnalysisJob(jobId, session.userId, locale);
    const businessId = await resolveDatasetAnalysisBusinessId(
      session.businessId ?? job.business_id ?? null
    );

    try {
      await syncDatasetAnalysisAgentRun({
        job,
        businessId,
      });
    } catch (error) {
      console.error(
        "Failed to sync dataset analysis agent run during job read.",
        error
      );
    }

    if (!businessId) {
      console.warn(
        "Dataset analysis agent run was not synced during job read because no business_id was available.",
        {
          jobId: job.job_id,
          userId: session.userId,
        }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        job: normalizeJob(job),
      },
    });
  } catch (error) {
    if (error instanceof DatasetAnalysisServiceError) {
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
          message: "Dataset analysis job lookup failed.",
        },
      },
      { status: 500 }
    );
  }
}
