import { NextResponse } from "next/server";
import { syncDatasetAnalysisAgentRun } from "@/lib/agent-runs/server";
import { getAppSession } from "@/lib/auth/session";
import { getNameValidationIssue } from "@/lib/validation/name-validation";
import {
  DatasetAnalysisServiceError,
  createDatasetAnalysisJob,
} from "@/lib/dataset-analysis/server";
import { getBackendAuthContext } from "@/lib/api/server";

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
  job: Awaited<ReturnType<typeof createDatasetAnalysisJob>>
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

export async function POST(request: Request) {
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

    const formData = await request.formData();
    const file = formData.get("file");
    const datasetName = formData.get("datasetName");
    const sourceName = formData.get("sourceName");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CSV_FILE_REQUIRED",
            message: "A CSV file is required.",
          },
        },
        { status: 422 }
      );
    }

    const normalizedDatasetName =
      typeof datasetName === "string" ? datasetName.trim() : "";

    if (!normalizedDatasetName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DATASET_NAME_REQUIRED",
            message: "A dataset name is required.",
          },
        },
        { status: 422 }
      );
    }

    if (
      getNameValidationIssue(normalizedDatasetName, {
        maxLength: 25,
      }) !== null
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_DATASET_NAME",
            message: "Dataset name must be between 3 and 25 characters.",
          },
        },
        { status: 422 }
      );
    }

    const businessId = await resolveDatasetAnalysisBusinessId(
      session.businessId
    );

    const job = await createDatasetAnalysisJob({
      file,
      datasetName: normalizedDatasetName,
      sourceName:
        typeof sourceName === "string" ? sourceName.trim() || null : file.name,
      ownerUserId: session.userId,
      businessId,
    });

    try {
      await syncDatasetAnalysisAgentRun({
        job,
        businessId,
      });
    } catch (error) {
      console.error(
        "Failed to sync dataset analysis agent run after job creation.",
        error
      );
    }

    if (!businessId) {
      console.warn(
        "Dataset analysis agent run was not synced because no business_id was available.",
        {
          jobId: job.job_id,
          userId: session.userId,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          job: normalizeJob(job),
        },
      },
      { status: 202 }
    );
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
          message: "Dataset analysis job creation failed.",
        },
      },
      { status: 500 }
    );
  }
}
