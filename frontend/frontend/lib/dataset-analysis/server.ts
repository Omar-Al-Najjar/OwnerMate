import "server-only";

const DEFAULT_ANALYSIS_SERVICE_URL = "http://127.0.0.1:8020";
const DEFAULT_ANALYSIS_SERVICE_SECRET = "ownermate-local-analysis-secret";

export type DatasetAnalysisServiceJobResponse = {
  job_id: string;
  status: "queued" | "running" | "success" | "error";
  created_at: string;
  updated_at: string;
  file_name: string;
  dataset_name: string | null;
  source_name: string | null;
  owner_user_id?: string | null;
  business_id?: string | null;
  result?: Record<string, unknown> | null;
  error?: {
    code?: string;
    message?: string;
    details?: string | null;
  } | null;
};

export class DatasetAnalysisServiceError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function getAnalysisServiceUrl() {
  return (
    process.env.DATASET_ANALYSIS_SERVICE_URL ?? DEFAULT_ANALYSIS_SERVICE_URL
  );
}

function getAnalysisServiceSecret() {
  return (
    process.env.DATASET_ANALYSIS_SERVICE_SECRET ??
    DEFAULT_ANALYSIS_SERVICE_SECRET
  );
}

function buildHeaders(ownerUserId?: string | null) {
  const headers = new Headers({
    "X-OwnerMate-Service-Secret": getAnalysisServiceSecret(),
  });

  if (ownerUserId) {
    headers.set("X-OwnerMate-Owner-User-Id", ownerUserId);
  }

  return headers;
}

async function readServiceBody<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

function toServiceError(
  response: Response,
  body: { detail?: string } | null,
  fallbackCode: string,
  fallbackMessage: string
) {
  return new DatasetAnalysisServiceError(
    fallbackCode,
    body?.detail ?? fallbackMessage,
    response.status || 500
  );
}

export async function createDatasetAnalysisJob(input: {
  file: File;
  datasetName: string;
  sourceName?: string | null;
  ownerUserId: string;
  businessId?: string | null;
}) {
  const formData = new FormData();
  formData.append("file", input.file, input.file.name);
  formData.append("dataset_name", input.datasetName);

  formData.append("source_name", input.sourceName ?? input.file.name);
  formData.append("owner_user_id", input.ownerUserId);

  if (input.businessId) {
    formData.append("business_id", input.businessId);
  }

  const response = await fetch(`${getAnalysisServiceUrl()}/jobs`, {
    method: "POST",
    headers: buildHeaders(input.ownerUserId),
    body: formData,
    cache: "no-store",
  });

  const body = await readServiceBody<DatasetAnalysisServiceJobResponse | { detail?: string }>(
    response
  );

  if (!response.ok) {
    throw toServiceError(
      response,
      body as { detail?: string } | null,
      "DATASET_ANALYSIS_CREATE_FAILED",
      "Dataset analysis job creation failed."
    );
  }

  return body as DatasetAnalysisServiceJobResponse;
}

export async function getDatasetAnalysisJob(
  jobId: string,
  ownerUserId: string,
  locale: "en" | "ar" = "en"
) {
  const jobUrl = new URL(`${getAnalysisServiceUrl()}/jobs/${jobId}`);
  jobUrl.searchParams.set("locale", locale);

  const response = await fetch(jobUrl, {
    headers: buildHeaders(ownerUserId),
    cache: "no-store",
  });

  const body = await readServiceBody<DatasetAnalysisServiceJobResponse | { detail?: string }>(
    response
  );

  if (!response.ok) {
    throw toServiceError(
      response,
      body as { detail?: string } | null,
      response.status === 404
        ? "DATASET_ANALYSIS_JOB_NOT_FOUND"
        : "DATASET_ANALYSIS_READ_FAILED",
      response.status === 404
        ? "Dataset analysis job not found."
        : "Dataset analysis job read failed."
    );
  }

  return body as DatasetAnalysisServiceJobResponse;
}
