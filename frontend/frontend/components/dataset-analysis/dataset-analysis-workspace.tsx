"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DataPanel } from "@/components/common/data-panel";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { Button } from "@/components/forms/button";
import { cn } from "@/lib/utils/cn";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { getNameValidationIssue } from "@/lib/validation/name-validation";
import type {
  DatasetAnalysisActionItem,
  DatasetAnalysisEnvelope,
  DatasetAnalysisJob,
  DatasetAnalysisJobStatus,
} from "@/types/dataset-analysis";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const DATASET_NAME_MAX_LENGTH = 25;

type ResultTab =
  | "overview"
  | "insights";

type WorkspaceStatus = "idle" | "uploading" | DatasetAnalysisJobStatus;

type DatasetAnalysisWorkspaceProps = {
  locale: Locale;
  dictionary: Dictionary;
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: string | null;
  };
};

type JobApiPayload = {
  job: DatasetAnalysisJob;
};

function getDatasetAnalysisErrorMessage(
  job: DatasetAnalysisJob | null,
  fallback = ""
) {
  return (
    job?.error?.details ??
    job?.result?.error?.details ??
    job?.error?.message ??
    job?.result?.error?.message ??
    fallback
  );
}

function getApiErrorMessage<T>(body: ApiEnvelope<T> | null, fallback: string) {
  return body?.error?.details ?? body?.error?.message ?? fallback;
}

function formatBytes(bytes: number | null, locale: Locale) {
  if (bytes == null || Number.isNaN(bytes)) {
    return "-";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-US", {
      maximumFractionDigits: 1,
    }).format(bytes / 1024)} KB`;
  }

  return `${new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-US", {
    maximumFractionDigits: 1,
  }).format(bytes / (1024 * 1024))} MB`;
}

function formatNumber(value: number | null | undefined, locale: Locale) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-US").format(
    value
  );
}

function formatTimestamp(value: string | null | undefined, locale: Locale) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatDuration(durationMs: number | null | undefined, locale: Locale) {
  if (durationMs == null || Number.isNaN(durationMs)) {
    return "-";
  }

  return `${new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-US", {
    maximumFractionDigits: 1,
  }).format(durationMs / 1000)}s`;
}

function humanizeMachineLabel(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return value.replace(/[_]+/g, " ");
}

function normalizeQuestionKey(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.trim().replace(/[؟?]+$/u, "").toLowerCase();
}

function getStatusLabel(
  status: WorkspaceStatus,
  dictionary: Dictionary["datasetAnalysis"]
) {
  if (status === "uploading") {
    return dictionary.statusUploading;
  }

  if (status === "queued") {
    return dictionary.statusQueued;
  }

  if (status === "running") {
    return dictionary.statusRunning;
  }

  if (status === "success") {
    return dictionary.statusSuccess;
  }

  if (status === "error") {
    return dictionary.statusError;
  }

  return dictionary.statusIdle;
}

function getStatusTone(status: WorkspaceStatus) {
  if (status === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200";
  }

  if (status === "error") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200";
  }

  if (status === "running" || status === "uploading") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200";
  }

  return "border-border bg-surface text-foreground";
}

function MetricTile({
  label,
  value,
  className,
  valueClassName,
  valueTitle,
}: {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
  valueTitle?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-surface/72 p-4 transition-colors duration-200 hover:-translate-y-px hover:border-primary/15 hover:shadow-panel",
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </p>
      <p
        className={cn(
          "metric-value mt-3 break-words text-2xl font-semibold tracking-tight text-foreground",
          valueClassName
        )}
        title={valueTitle ?? value}
      >
        {value}
      </p>
    </div>
  );
}

function ActionItemCard({
  action,
  dictionary,
}: {
  action: DatasetAnalysisActionItem;
  dictionary: Dictionary["datasetAnalysis"];
}) {
  const priorityTone =
    action.priority === "High"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200"
      : action.priority === "Medium"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200"
        : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="break-words text-base font-semibold text-foreground">
          {action.title}
        </h3>
        <span
          className={cn(
            "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
            priorityTone
          )}
        >
          {action.priority === "High"
            ? dictionary.priorityHigh
            : action.priority === "Medium"
              ? dictionary.priorityMedium
              : dictionary.priorityLow}
        </span>
      </div>
      <div className="mt-4 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {dictionary.whatLabel}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted">{action.what}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {dictionary.whyLabel}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted">
            {action.why_it_matters}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {dictionary.recommendationLabel}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted">
            {action.recommendation}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {dictionary.expectedImpactLabel}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted">
            {action.expected_impact}
          </p>
        </div>
      </div>
    </div>
  );
}

export function DatasetAnalysisWorkspace({
  locale,
  dictionary,
}: DatasetAnalysisWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const jobIdFromUrl = searchParams.get("jobId");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [workspaceStatus, setWorkspaceStatus] =
    useState<WorkspaceStatus>("idle");
  const [job, setJob] = useState<DatasetAnalysisJob | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState<ResultTab>("overview");
  const [isHydratingJob, setIsHydratingJob] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const latestRequestedJobIdRef = useRef<string | null>(jobIdFromUrl);
  const currentJobId = job?.jobId ?? null;
  const currentJobStatus = job?.status ?? null;

  const validationMessage = !selectedFile
    ? dictionary.datasetAnalysis.fileValidationMissing
    : !selectedFile.name.toLowerCase().endsWith(".csv")
      ? dictionary.datasetAnalysis.fileValidationType
      : selectedFile.size > MAX_UPLOAD_BYTES
        ? dictionary.datasetAnalysis.fileValidationSize
        : dictionary.datasetAnalysis.fileValidationReady;

  const fileIsValid =
    !!selectedFile &&
    selectedFile.name.toLowerCase().endsWith(".csv") &&
    selectedFile.size <= MAX_UPLOAD_BYTES;
  const datasetNameValue = datasetName.trim();
  const datasetNameIssue = getNameValidationIssue(datasetName, {
    required: true,
    maxLength: DATASET_NAME_MAX_LENGTH,
  });
  const datasetNameIsValid = datasetNameIssue === null;

  function clearActiveJobRecovery() {
    latestRequestedJobIdRef.current = null;
    setJob(null);
    setWorkspaceStatus("idle");
    setErrorMessage("");
    setActiveTab("overview");

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("jobId");
    const nextQuery = nextSearchParams.toString();
    router.replace(
      (nextQuery ? `${pathname}?${nextQuery}` : pathname) as Route,
      { scroll: false }
    );
  }

  const clearUnrecoverableJob = useCallback((jobId: string) => {
    if (latestRequestedJobIdRef.current === jobId) {
      latestRequestedJobIdRef.current = null;
    }

    setJob(null);
    setActiveTab("overview");

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    if (nextSearchParams.get("jobId") === jobId) {
      nextSearchParams.delete("jobId");
      const nextQuery = nextSearchParams.toString();
      router.replace(
        (nextQuery ? `${pathname}?${nextQuery}` : pathname) as Route,
        { scroll: false }
      );
    }
  }, [pathname, router, searchParams]);

  function handleFileSelection(file: File | null) {
    setSelectedFile(file);
    if (file) {
      clearActiveJobRecovery();
    }
  }

  function handleClearSelectedFile() {
    setSelectedFile(null);
    clearActiveJobRecovery();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const loadJob = useCallback(
    async (jobId: string, silent = false) => {
      latestRequestedJobIdRef.current = jobId;
      if (!silent) {
        setIsHydratingJob(true);
      }

      try {
        const localizedJobUrl = new URL(
          `/api/dataset-analysis/jobs/${jobId}`,
          window.location.origin
        );
        localizedJobUrl.searchParams.set("locale", locale);
        const response = await fetch(localizedJobUrl, { cache: "no-store" });
        const body = (await response.json().catch(() => null)) as
          | ApiEnvelope<JobApiPayload>
          | null;

        if (!response.ok || !body?.success || !body.data?.job) {
          if (latestRequestedJobIdRef.current !== jobId) {
            return;
          }
          setJob(null);
          setActiveTab("overview");
          if (response.status === 404) {
            clearUnrecoverableJob(jobId);
          }
          setWorkspaceStatus("error");
          setErrorMessage(
            getApiErrorMessage(body, dictionary.datasetAnalysis.errorDescription)
          );
          return;
        }

        if (latestRequestedJobIdRef.current !== jobId) {
          return;
        }
        setJob(body.data.job);
        setWorkspaceStatus(body.data.job.status);
        setErrorMessage(getDatasetAnalysisErrorMessage(body.data.job));
      } catch {
        if (latestRequestedJobIdRef.current !== jobId) {
          return;
        }
        setJob(null);
        setActiveTab("overview");
        setWorkspaceStatus("error");
        setErrorMessage(dictionary.datasetAnalysis.errorDescription);
      } finally {
        if (!silent) {
          setIsHydratingJob(false);
        }
      }
    },
    [clearUnrecoverableJob, dictionary.datasetAnalysis.errorDescription, locale]
  );

  useEffect(() => {
    latestRequestedJobIdRef.current = jobIdFromUrl;
    if (!jobIdFromUrl) {
      if (!currentJobId) {
        setWorkspaceStatus("idle");
      }
      return;
    }

    void loadJob(jobIdFromUrl, false);
  }, [currentJobId, jobIdFromUrl, loadJob, locale]);

  useEffect(() => {
    if (!jobIdFromUrl) {
      return;
    }

    const shouldPoll =
      !currentJobId ||
      currentJobId !== jobIdFromUrl ||
      currentJobStatus === "queued" ||
      currentJobStatus === "running";

    if (!shouldPoll) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadJob(jobIdFromUrl, true);
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [currentJobId, currentJobStatus, jobIdFromUrl, loadJob]);

  async function handleStartAnalysis() {
    if (!fileIsValid || !selectedFile) {
      setWorkspaceStatus("error");
      setErrorMessage(validationMessage);
      return;
    }

    if (!datasetNameIsValid) {
      setWorkspaceStatus("error");
      setErrorMessage(
        datasetNameIssue === "required"
          ? dictionary.datasetAnalysis.datasetNameRequired
          : dictionary.datasetAnalysis.datasetNameLengthError
      );
      return;
    }

    const payload = new FormData();
    payload.append("file", selectedFile, selectedFile.name);
    payload.append("sourceName", selectedFile.name);
    payload.append("datasetName", datasetNameValue);

    latestRequestedJobIdRef.current = null;
    setJob(null);
    setWorkspaceStatus("uploading");
    setErrorMessage("");
    setActiveTab("overview");

    try {
      const response = await fetch("/api/dataset-analysis/jobs", {
        method: "POST",
        body: payload,
      });
      const body = (await response.json().catch(() => null)) as
        | ApiEnvelope<JobApiPayload>
        | null;

      if (!response.ok || !body?.success || !body.data?.job) {
        setWorkspaceStatus("error");
        setErrorMessage(
          getApiErrorMessage(body, dictionary.datasetAnalysis.errorDescription)
        );
        return;
      }

      latestRequestedJobIdRef.current = body.data.job.jobId;
      setJob(body.data.job);
      setWorkspaceStatus(body.data.job.status);
      setErrorMessage(getDatasetAnalysisErrorMessage(body.data.job));
      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.set("jobId", body.data.job.jobId);
      router.replace(
        `${pathname}?${nextSearchParams.toString()}` as Route,
        {
          scroll: false,
        }
      );
    } catch {
      setWorkspaceStatus("error");
      setErrorMessage(dictionary.datasetAnalysis.errorDescription);
    }
  }

  const result = job?.result as DatasetAnalysisEnvelope | null;
  const canonicalDatasetName =
    result?.data.dataset.dataset_name ??
    job?.datasetName ??
    result?.data.semantic_model.dataset_name ??
    "-";
  const generatedQuestionCount =
    result?.data.questions.total ??
    result?.data.questions.items.length ??
    0;
  const tabs: Array<{ key: ResultTab; label: string }> = [
    { key: "overview", label: dictionary.datasetAnalysis.overviewTab },
    { key: "insights", label: dictionary.datasetAnalysis.insightsTab },
  ];
  const shouldShowPendingResultState =
    workspaceStatus === "uploading" ||
    workspaceStatus === "queued" ||
    workspaceStatus === "running";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)] xl:items-start">
        <section className="space-y-6">
        <DataPanel title={dictionary.datasetAnalysis.uploadTitle}>
          <div className="space-y-5">
            <p className="text-sm leading-7 text-muted">
              {dictionary.datasetAnalysis.uploadDescription}
            </p>
            <label className="block space-y-2 text-start">
              <span className="text-sm font-medium text-foreground">
                {dictionary.datasetAnalysis.datasetNameLabel}
              </span>
              <input
                className={cn(
                  "w-full rounded-2xl border bg-surface px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-primary",
                  datasetName.length > 0 && !datasetNameIsValid
                    ? "border-red-300 dark:border-red-800"
                    : "border-border"
                )}
                onChange={(event) => setDatasetName(event.target.value)}
                maxLength={DATASET_NAME_MAX_LENGTH}
                placeholder={dictionary.datasetAnalysis.datasetNamePlaceholder}
                required
                type="text"
                value={datasetName}
              />
              <p
                className={cn(
                  "text-xs",
                  datasetNameIsValid
                    ? "text-muted"
                    : "text-red-600 dark:text-red-300"
                )}
              >
                {datasetNameIsValid
                  ? dictionary.datasetAnalysis.datasetNamePlaceholder
                  : datasetNameIssue === "required"
                    ? dictionary.datasetAnalysis.datasetNameRequired
                    : dictionary.datasetAnalysis.datasetNameLengthError}
              </p>
            </label>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {dictionary.datasetAnalysis.fileLabel}
              </p>
              <div className="relative">
                <label
                  className={cn(
                    "flex cursor-pointer rounded-3xl border border-dashed border-border bg-surface/70 transition hover:border-primary/40 hover:bg-surface",
                    selectedFile
                      ? "items-start gap-4 px-5 py-5 text-start"
                      : "flex-col items-center justify-center gap-3 px-6 py-10 text-center"
                  )}
                >
                  <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-primary shadow-sm dark:bg-indigo-950/40 dark:text-indigo-100">
                    {selectedFile ? (
                      <svg
                        aria-hidden="true"
                        className="h-7 w-7"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M8 3.75H14.5L19.25 8.5V18.5C19.25 19.74 18.24 20.75 17 20.75H8C6.76 20.75 5.75 19.74 5.75 18.5V6C5.75 4.76 6.76 3.75 8 3.75Z"
                          stroke="currentColor"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                        />
                        <path
                          d="M14.25 3.75V8.75H19.25"
                          stroke="currentColor"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                        />
                        <path
                          d="M8.75 13.25H16.25"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeWidth="1.8"
                        />
                        <path
                          d="M8.75 16.25H13.25"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeWidth="1.8"
                        />
                      </svg>
                    ) : (
                      <svg
                        aria-hidden="true"
                        className="h-7 w-7"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M12 4.5V15.5"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeWidth="1.8"
                        />
                        <path
                          d="M8.5 8L12 4.5L15.5 8"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                        />
                        <path
                          d="M5 17.5C5 18.88 6.12 20 7.5 20H16.5C17.88 20 19 18.88 19 17.5"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeWidth="1.8"
                        />
                      </svg>
                    )}
                  </span>
                  {selectedFile ? (
                    <div className="min-w-0 flex-1 space-y-1">
                      <p
                        className="truncate text-base font-semibold text-foreground"
                        title={selectedFile.name}
                      >
                        {selectedFile.name}
                      </p>
                      <p className="text-sm text-muted">
                        {formatBytes(selectedFile.size, locale)}
                      </p>
                      <p className="text-sm text-muted">
                        {dictionary.datasetAnalysis.fileReplace}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-foreground">
                        {dictionary.datasetAnalysis.fileSelect}
                      </p>
                      <p className="text-sm text-muted">
                        {dictionary.datasetAnalysis.uploadHint}
                      </p>
                    </div>
                  )}
                  <input
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={(event) =>
                      handleFileSelection(event.target.files?.[0] ?? null)
                    }
                    onClick={(event) => {
                      event.currentTarget.value = "";
                    }}
                    ref={fileInputRef}
                    type="file"
                  />
                </label>
                {selectedFile ? (
                  <button
                    aria-label={`${dictionary.common.remove} ${selectedFile.name}`}
                    className="absolute end-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition hover:border-primary/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={workspaceStatus === "uploading"}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleClearSelectedFile();
                    }}
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M7 7L17 17"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M17 7L7 17"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">
                  {dictionary.datasetAnalysis.fileValidationLabel}
                </p>
                <span
                  className={cn(
                    "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                    fileIsValid
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200"
                      : "border-border bg-card text-muted"
                  )}
                >
                  {validationMessage}
                </span>
              </div>
            </div>

            <Button
              disabled={
                workspaceStatus === "uploading" ||
                !fileIsValid ||
                !datasetNameIsValid
              }
              onClick={handleStartAnalysis}
              type="button"
            >
              {workspaceStatus === "uploading"
                ? dictionary.datasetAnalysis.startPendingButton
                : dictionary.datasetAnalysis.startButton}
            </Button>
          </div>
        </DataPanel>

        </section>

        <section className="space-y-6">
          <DataPanel title={dictionary.datasetAnalysis.statusTitle}>
            <div className="space-y-4">
              <p className="text-sm leading-7 text-muted">
                {dictionary.datasetAnalysis.statusDescription}
              </p>
              <div
                className={cn(
                  "min-h-[9.5rem] rounded-2xl border px-4 py-4",
                  getStatusTone(workspaceStatus)
                )}
              >
                <div className="flex h-full flex-col justify-between gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                        {dictionary.datasetAnalysis.runStatusLabel}
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        {getStatusLabel(workspaceStatus, dictionary.datasetAnalysis)}
                      </p>
                    </div>
                    <div className="min-h-[1rem] text-xs text-current/80">
                      {job?.jobId ? (
                        <>
                          <span className="font-semibold">
                            {dictionary.datasetAnalysis.jobIdLabel}:
                          </span>{" "}
                          {job.jobId}
                        </>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-sm leading-7 text-current/85">
                    {workspaceStatus === "queued"
                      ? dictionary.datasetAnalysis.queuedDescription
                      : workspaceStatus === "running" ||
                          workspaceStatus === "uploading"
                        ? dictionary.datasetAnalysis.runningDescription
                        : workspaceStatus === "success"
                          ? dictionary.datasetAnalysis.successDescription
                          : workspaceStatus === "error"
                            ? errorMessage ||
                              dictionary.datasetAnalysis.errorDescription
                            : dictionary.datasetAnalysis.emptyDescription}
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <MetricTile
                  label={dictionary.datasetAnalysis.createdAtLabel}
                  value={formatTimestamp(job?.createdAt, locale)}
                />
                <MetricTile
                  label={dictionary.datasetAnalysis.updatedAtLabel}
                  value={formatTimestamp(job?.updatedAt, locale)}
                />
              </div>
            </div>
          </DataPanel>

          <DataPanel title={dictionary.datasetAnalysis.previewTitle}>
            <div className="space-y-4">
              <p className="text-sm leading-7 text-muted">
                {dictionary.datasetAnalysis.previewDescription}
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <MetricTile
                  label={dictionary.datasetAnalysis.fileNameLabel}
                  value={selectedFile?.name ?? "-"}
                />
                <MetricTile
                  label={dictionary.datasetAnalysis.fileSizeLabel}
                  value={formatBytes(selectedFile?.size ?? null, locale)}
                />
              </div>
            </div>
          </DataPanel>

        </section>
      </div>

      {isHydratingJob ? (
        <LoadingSkeleton />
      ) : workspaceStatus === "error" && !result ? (
        <ErrorState
          description={
            errorMessage || dictionary.datasetAnalysis.errorDescription
          }
          title={dictionary.datasetAnalysis.errorTitle}
        />
      ) : job && result ? (
        <section className="space-y-5">
            <div className="panel space-y-5 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {dictionary.datasetAnalysis.resultTitle}
                  </p>
                  <p className="mt-1 text-sm leading-7 text-muted">
                    {result.task_type}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                    getStatusTone(job.status)
                  )}
                >
                  {result.status === "partial_success"
                    ? dictionary.datasetAnalysis.partialSuccess
                    : getStatusLabel(job.status, dictionary.datasetAnalysis)}
                </span>
              </div>
              {result.status === "partial_success" ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
                  {dictionary.datasetAnalysis.partialSuccess}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={cn(
                      "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-medium transition",
                      activeTab === tab.key
                        ? "border-primary bg-indigo-50 text-primary shadow-sm dark:bg-indigo-950/30 dark:text-indigo-100"
                        : "border-border bg-card text-muted hover:-translate-y-px hover:border-primary/35 hover:text-foreground"
                    )}
                    onClick={() => setActiveTab(tab.key)}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "overview" ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricTile
                    label={dictionary.datasetAnalysis.rowsLabel}
                    value={formatNumber(result.data.dataset.row_count, locale)}
                  />
                  <MetricTile
                    label={dictionary.datasetAnalysis.columnsLabel}
                    value={formatNumber(result.data.dataset.column_count, locale)}
                  />
                  <MetricTile
                    label={dictionary.datasetAnalysis.questionsLabel}
                    value={formatNumber(generatedQuestionCount, locale)}
                  />
                  <MetricTile
                    label={dictionary.datasetAnalysis.runtimeLabel}
                    value={formatDuration(result.meta.duration_ms, locale)}
                  />
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                  <DataPanel title={dictionary.datasetAnalysis.datasetSummaryTitle}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <MetricTile
                        className="sm:col-span-2"
                        label={dictionary.datasetAnalysis.fileNameLabel}
                        value={result.data.dataset.file_name ?? "-"}
                        valueClassName="text-lg leading-snug break-all sm:text-xl"
                        valueTitle={result.data.dataset.file_name ?? "-"}
                      />
                      <MetricTile
                        className="sm:col-span-2"
                        label={dictionary.datasetAnalysis.datasetNameLabel}
                        value={canonicalDatasetName}
                        valueClassName="whitespace-normal break-normal [overflow-wrap:normal] hyphens-none text-lg leading-snug sm:text-xl"
                        valueTitle={canonicalDatasetName}
                      />
                      <MetricTile
                        label={dictionary.datasetAnalysis.memoryLabel}
                        value={formatBytes(
                          result.data.dataset.memory_kb != null
                            ? result.data.dataset.memory_kb * 1024
                            : null,
                          locale
                        )}
                        valueClassName="text-xl leading-snug sm:text-2xl"
                      />
                      <MetricTile
                        label={dictionary.datasetAnalysis.missingValuesLabel}
                        value={formatNumber(
                          result.data.dataset.missing_count,
                          locale
                        )}
                        valueClassName="text-xl leading-none sm:text-2xl"
                      />
                      <MetricTile
                        label={dictionary.datasetAnalysis.duplicateRowsLabel}
                        value={formatNumber(
                          result.data.dataset.duplicate_row_count,
                          locale
                        )}
                        valueClassName="text-xl leading-none sm:text-2xl"
                      />
                    </div>
                  </DataPanel>

                  <DataPanel title={dictionary.datasetAnalysis.statusTitle}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <MetricTile
                        className="sm:col-span-2"
                        label={dictionary.datasetAnalysis.agentLabel}
                        value={humanizeMachineLabel(result.meta.agent)}
                        valueClassName="text-lg leading-snug sm:text-xl"
                        valueTitle={result.meta.agent}
                      />
                      <MetricTile
                        className="sm:col-span-2"
                        label={dictionary.datasetAnalysis.modelLabel}
                        value={result.meta.model}
                        valueClassName="text-lg leading-snug sm:text-xl"
                        valueTitle={result.meta.model}
                      />
                      <MetricTile
                        label={dictionary.datasetAnalysis.successfulQueriesLabel}
                        value={formatNumber(
                          result.meta.successful_queries,
                          locale
                        )}
                        valueClassName="text-xl leading-none sm:text-2xl"
                      />
                      <MetricTile
                        label={dictionary.datasetAnalysis.failedQueriesLabel}
                        value={formatNumber(result.meta.failed_queries, locale)}
                        valueClassName="text-xl leading-none sm:text-2xl"
                      />
                    </div>
                  </DataPanel>
                </div>

              </div>
            ) : null}

            {activeTab === "insights" ? (
              <div className="space-y-5">
                <DataPanel title={dictionary.datasetAnalysis.executiveSummaryTitle}>
                  <p className="text-sm leading-7 text-muted">
                    {result.data.insights.executive_summary ??
                      dictionary.datasetAnalysis.noItemsLabel}
                  </p>
                </DataPanel>

                <DataPanel title={dictionary.datasetAnalysis.positiveHighlightsTitle}>
                  {result.data.insights.positive_highlights.length ? (
                    <div className="space-y-3">
                      {result.data.insights.positive_highlights.map((item) => (
                        <div
                          key={item}
                          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      description={dictionary.datasetAnalysis.noItemsLabel}
                      title={dictionary.datasetAnalysis.positiveHighlightsTitle}
                    />
                  )}
                </DataPanel>

                <DataPanel title={dictionary.datasetAnalysis.actionItemsTitle}>
                  {result.data.insights.action_items.length ? (
                    <div className="space-y-4">
                      {result.data.insights.action_items.map((action) => (
                        <ActionItemCard
                          action={action}
                          dictionary={dictionary.datasetAnalysis}
                          key={`${action.priority}-${action.title}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      description={dictionary.datasetAnalysis.noItemsLabel}
                      title={dictionary.datasetAnalysis.actionItemsTitle}
                    />
                  )}
                </DataPanel>

                <DataPanel title={dictionary.datasetAnalysis.watchOutTitle}>
                  {result.data.insights.watch_out_for.length ? (
                    <div className="space-y-3">
                      {result.data.insights.watch_out_for.map((item) => (
                        <div
                          key={item}
                          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      description={dictionary.datasetAnalysis.noItemsLabel}
                      title={dictionary.datasetAnalysis.watchOutTitle}
                    />
                  )}
                </DataPanel>
              </div>
            ) : null}
        </section>
      ) : shouldShowPendingResultState ? (
        <LoadingSkeleton />
      ) : (
        <EmptyState
          description={dictionary.datasetAnalysis.emptyDescription}
          title={dictionary.datasetAnalysis.emptyTitle}
        />
      )}
    </div>
  );
}
