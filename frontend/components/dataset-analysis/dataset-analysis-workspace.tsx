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
  DatasetAnalysisQueryResult,
} from "@/types/dataset-analysis";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const DATASET_NAME_MAX_LENGTH = 25;

type ResultTab =
  | "overview"
  | "insights"
  | "findings"
  | "questions"
  | "semantic-model"
  | "run";

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

function JsonPanel({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <pre className="overflow-x-auto rounded-2xl bg-slate-950 px-4 py-4 text-xs leading-6 text-slate-100">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
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
        "rounded-2xl border border-border bg-surface/70 p-4 transition-colors duration-200 hover:border-primary/15",
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-3 break-words text-2xl font-semibold tracking-tight text-foreground",
          valueClassName
        )}
        title={valueTitle ?? value}
      >
        {value}
      </p>
    </div>
  );
}

function PreviewTable({
  rows,
  emptyLabel,
}: {
  rows: Array<Record<string, unknown>>;
  emptyLabel: string;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/60 px-4 py-6 text-sm text-muted">
        {emptyLabel}
      </div>
    );
  }

  const columns = Object.keys(rows[0] ?? {});

  if (!columns.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/60 px-4 py-6 text-sm text-muted">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-surface/80">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="px-4 py-3 text-start font-semibold text-foreground"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {rows.map((row, rowIndex) => (
            <tr key={`preview-row-${rowIndex}`}>
              {columns.map((column) => (
                <td
                  key={`${rowIndex}-${column}`}
                  className="max-w-[220px] px-4 py-3 align-top text-muted"
                >
                  <span className="break-words">
                    {typeof row[column] === "string"
                    ? row[column]
                    : JSON.stringify(row[column] ?? null)}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QueryPanels({
  items,
  emptyLabel,
  dictionary,
}: {
  items: DatasetAnalysisQueryResult[];
  emptyLabel: string;
  dictionary: Dictionary["datasetAnalysis"];
}) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/60 px-4 py-6 text-sm text-muted">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div
          key={`${item.question}-${item.query}`}
          className="rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <h3 className="break-words text-base font-semibold text-foreground">
            {item.question}
          </h3>
          {item.error ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200">
              {item.error}
            </p>
          ) : null}
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                {dictionary.generatedCodeLabel}
              </p>
              <pre className="overflow-x-auto rounded-2xl bg-slate-950 px-4 py-4 text-xs leading-6 text-slate-100">
                {item.query || "-"}
              </pre>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-surface/60 p-4">
                <p className="text-sm font-semibold text-foreground">
                  {dictionary.actualResultLabel}
                </p>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-muted">
                  {item.actual_result || item.result_summary || "-"}
                </pre>
              </div>
              <div className="rounded-2xl border border-border bg-surface/60 p-4">
                <p className="text-sm font-semibold text-foreground">
                  {dictionary.businessExplanationLabel}
                </p>
                <p className="mt-3 break-words text-sm leading-7 text-muted">
                  {item.explanation || "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
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

  function handleClearSelectedFile() {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const loadJob = useCallback(
    async (jobId: string, silent = false) => {
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
          setWorkspaceStatus("error");
          setErrorMessage(
            getApiErrorMessage(body, dictionary.datasetAnalysis.errorDescription)
          );
          return;
        }

        setJob(body.data.job);
        setWorkspaceStatus(body.data.job.status);
        setErrorMessage(getDatasetAnalysisErrorMessage(body.data.job));
      } catch {
        setWorkspaceStatus("error");
        setErrorMessage(dictionary.datasetAnalysis.errorDescription);
      } finally {
        if (!silent) {
          setIsHydratingJob(false);
        }
      }
    },
    [dictionary.datasetAnalysis.errorDescription, locale]
  );

  useEffect(() => {
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
  const tabs: Array<{ key: ResultTab; label: string }> = [
    { key: "overview", label: dictionary.datasetAnalysis.overviewTab },
    { key: "insights", label: dictionary.datasetAnalysis.insightsTab },
    { key: "findings", label: dictionary.datasetAnalysis.findingsTab },
    { key: "questions", label: dictionary.datasetAnalysis.questionsTab },
    {
      key: "semantic-model",
      label: dictionary.datasetAnalysis.semanticModelTab,
    },
    { key: "run", label: dictionary.datasetAnalysis.runTab },
  ];
  const answeredQuestionKeys = new Set(
    result?.data.findings.successful.map((item) =>
      normalizeQuestionKey(item.question)
    ) ?? []
  );
  const visibleQuestionItems =
    result?.data.questions.items.filter((item) =>
      answeredQuestionKeys.has(normalizeQuestionKey(item.question))
    ) ?? [];
  const visibleQuestionGroups = Object.fromEntries(
    Object.entries(result?.data.questions.groups ?? {})
      .map(([groupName, items]) => [
        groupName,
        items.filter((item) =>
          answeredQuestionKeys.has(normalizeQuestionKey(item.question))
        ),
      ])
      .filter(([, items]) => items.length > 0)
  );
  const visiblePriorityQuestionCount = visibleQuestionItems.filter(
    (item) => item.priority
  ).length;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
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
                      setSelectedFile(event.target.files?.[0] ?? null)
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

      <section className="space-y-6">
        <DataPanel title={dictionary.datasetAnalysis.statusTitle}>
          <div className="space-y-4">
            <p className="text-sm leading-7 text-muted">
              {dictionary.datasetAnalysis.statusDescription}
            </p>
            <div
              className={cn(
                "rounded-2xl border px-4 py-4",
                getStatusTone(workspaceStatus)
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                    {dictionary.datasetAnalysis.runStatusLabel}
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {getStatusLabel(workspaceStatus, dictionary.datasetAnalysis)}
                  </p>
                </div>
                {job?.jobId ? (
                  <div className="text-xs text-current/80">
                    <span className="font-semibold">
                      {dictionary.datasetAnalysis.jobIdLabel}:
                    </span>{" "}
                    {job.jobId}
                  </div>
                ) : null}
              </div>
              <p className="mt-4 text-sm leading-7 text-current/85">
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
            {job ? (
              <div className="grid gap-4 md:grid-cols-2">
                <MetricTile
                  label={dictionary.datasetAnalysis.createdAtLabel}
                  value={formatTimestamp(job.createdAt, locale)}
                />
                <MetricTile
                  label={dictionary.datasetAnalysis.updatedAtLabel}
                  value={formatTimestamp(job.updatedAt, locale)}
                />
              </div>
            ) : null}
          </div>
        </DataPanel>

        {isHydratingJob ? <LoadingSkeleton /> : null}

        {!job && workspaceStatus === "idle" ? (
          <EmptyState
            description={dictionary.datasetAnalysis.emptyDescription}
            title={dictionary.datasetAnalysis.emptyTitle}
          />
        ) : null}

        {workspaceStatus === "error" && !result ? (
          <ErrorState
            description={
              errorMessage || dictionary.datasetAnalysis.errorDescription
            }
            title={dictionary.datasetAnalysis.errorTitle}
          />
        ) : null}

        {job && result ? (
          <div className="space-y-5">
            <div className="panel space-y-5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {dictionary.datasetAnalysis.resultTitle}
                  </p>
                  <p className="mt-1 text-sm text-muted">
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
                      "inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-medium transition",
                      activeTab === tab.key
                        ? "border-primary bg-indigo-50 text-primary dark:bg-indigo-950/30 dark:text-indigo-100"
                        : "border-border bg-card text-muted hover:border-primary/35 hover:text-foreground"
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
                    value={formatNumber(result.meta.question_count, locale)}
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

                <DataPanel title={dictionary.datasetAnalysis.datasetPreviewTitle}>
                  <PreviewTable
                    emptyLabel={dictionary.datasetAnalysis.noPreviewLabel}
                    rows={result.data.dataset.preview_rows}
                  />
                </DataPanel>
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

            {activeTab === "findings" ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <MetricTile
                    label={dictionary.datasetAnalysis.totalQuestionsLabel}
                    value={formatNumber(result.data.findings.total, locale)}
                  />
                  <MetricTile
                    label={dictionary.datasetAnalysis.successfulCountLabel}
                    value={formatNumber(
                      result.data.findings.successful_count,
                      locale
                    )}
                  />
                  <MetricTile
                    label={dictionary.datasetAnalysis.failedCountLabel}
                    value={formatNumber(result.data.findings.failed_count, locale)}
                  />
                </div>
                <DataPanel title={dictionary.datasetAnalysis.successfulCountLabel}>
                  <QueryPanels
                    dictionary={dictionary.datasetAnalysis}
                    emptyLabel={dictionary.datasetAnalysis.noItemsLabel}
                    items={result.data.findings.successful}
                  />
                </DataPanel>
              </div>
            ) : null}

            {activeTab === "questions" ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <MetricTile
                    label={dictionary.datasetAnalysis.totalQuestionsLabel}
                    value={formatNumber(visibleQuestionItems.length, locale)}
                  />
                  <MetricTile
                    label={dictionary.datasetAnalysis.questionFloorLabel}
                    value={formatNumber(
                      result.data.questions.question_floor,
                      locale
                    )}
                  />
                  <MetricTile
                    label={dictionary.datasetAnalysis.priorityQuestionsLabel}
                    value={formatNumber(
                      visiblePriorityQuestionCount,
                      locale
                    )}
                  />
                </div>

                <DataPanel title={dictionary.datasetAnalysis.datasetUnderstandingLabel}>
                  <p className="break-words text-sm leading-7 text-muted">
                    {result.data.questions.dataset_understanding ??
                      dictionary.datasetAnalysis.noItemsLabel}
                  </p>
                </DataPanel>

                <DataPanel title={dictionary.datasetAnalysis.questionsTab}>
                  {Object.keys(visibleQuestionGroups).length ? (
                    <div className="space-y-4">
                      {Object.entries(visibleQuestionGroups).map(
                        ([groupName, items]) => (
                          <div
                            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                            key={groupName}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="break-words text-base font-semibold text-foreground">
                                {groupName}
                              </h3>
                              <span className="text-sm text-muted">
                                {formatNumber(items.length, locale)}
                              </span>
                            </div>
                            <div className="mt-4 space-y-3">
                              {items.map((item) => (
                                <div
                                  className="rounded-2xl border border-border bg-surface/60 px-4 py-4"
                                  key={`${groupName}-${item.question}`}
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="break-words text-sm font-medium text-foreground">
                                      {item.question}
                                    </p>
                                    {item.priority ? (
                                      <span className="inline-flex rounded-full border border-primary/20 bg-indigo-50 px-3 py-1 text-xs font-semibold text-primary dark:bg-indigo-950/30 dark:text-indigo-100">
                                        {dictionary.datasetAnalysis.priorityQuestionsLabel}
                                      </span>
                                    ) : null}
                                  </div>
                                  {item.priority_reason ? (
                                    <p className="mt-2 break-words text-sm leading-7 text-muted">
                                      {item.priority_reason}
                                    </p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <EmptyState
                      description={dictionary.datasetAnalysis.noItemsLabel}
                      title={dictionary.datasetAnalysis.questionsTab}
                    />
                  )}
                </DataPanel>
              </div>
            ) : null}

            {activeTab === "semantic-model" ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-10">
                  <MetricTile
                    className="xl:col-span-2"
                    label={dictionary.datasetAnalysis.datasetNameLabel}
                    value={canonicalDatasetName}
                    valueClassName="whitespace-normal break-normal [overflow-wrap:normal] hyphens-none text-lg leading-snug sm:text-xl"
                    valueTitle={canonicalDatasetName}
                  />
                  <MetricTile
                    className="md:col-span-2 xl:col-span-4"
                    label={dictionary.datasetAnalysis.inferredDomainLabel}
                    value={result.data.semantic_model.inferred_domain ?? "-"}
                    valueClassName="max-w-[28ch] text-lg leading-snug sm:text-xl"
                    valueTitle={result.data.semantic_model.inferred_domain ?? "-"}
                  />
                  <MetricTile
                    className="xl:col-span-2"
                    label={dictionary.datasetAnalysis.rowsLabel}
                    value={formatNumber(
                      result.data.semantic_model.row_count,
                      locale
                    )}
                    valueClassName="whitespace-nowrap text-[1.9rem] leading-none sm:text-[2.35rem]"
                  />
                  <MetricTile
                    className="xl:col-span-2"
                    label={dictionary.datasetAnalysis.columnsLabel}
                    value={formatNumber(
                      result.data.semantic_model.column_count,
                      locale
                    )}
                    valueClassName="whitespace-nowrap text-[1.9rem] leading-none sm:text-[2.35rem]"
                  />
                </div>

                <DataPanel title={dictionary.datasetAnalysis.semanticModelTab}>
                  <div className="space-y-4">
                    {result.data.semantic_model.dataset_description ? (
                      <p className="break-words text-sm leading-7 text-muted">
                        {result.data.semantic_model.dataset_description}
                      </p>
                    ) : null}
                    <div className="grid gap-4">
                      <MetricTile
                        label={dictionary.datasetAnalysis.timeColumnLabel}
                        value={result.data.semantic_model.time_column ?? "-"}
                      />
                      <MetricTile
                        label={dictionary.datasetAnalysis.primaryKeysLabel}
                        value={
                          result.data.semantic_model.primary_keys.join(", ") ||
                          "-"
                        }
                      />
                      <MetricTile
                        label={dictionary.datasetAnalysis.relationshipsLabel}
                        value={
                          result.data.semantic_model.relationships.join(", ") ||
                          "-"
                        }
                      />
                    </div>
                  </div>
                </DataPanel>

                <DataPanel title={dictionary.datasetAnalysis.columnsTableTitle}>
                  {result.data.semantic_model.columns.length ? (
                    <div className="overflow-x-auto rounded-2xl border border-border">
                      <table className="min-w-full divide-y divide-border text-sm">
                        <thead className="bg-surface/80">
                          <tr>
                            <th className="px-4 py-3 text-start font-semibold text-foreground">
                              {dictionary.datasetAnalysis.columnNameLabel}
                            </th>
                            <th className="px-4 py-3 text-start font-semibold text-foreground">
                              {dictionary.datasetAnalysis.columnTypeLabel}
                            </th>
                            <th className="px-4 py-3 text-start font-semibold text-foreground">
                              {dictionary.datasetAnalysis.columnRoleLabel}
                            </th>
                            <th className="px-4 py-3 text-start font-semibold text-foreground">
                              {dictionary.datasetAnalysis.columnDescriptionLabel}
                            </th>
                            <th className="px-4 py-3 text-start font-semibold text-foreground">
                              {dictionary.datasetAnalysis.columnUnitLabel}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-card">
                          {result.data.semantic_model.columns.map((column) => (
                            <tr key={column.name}>
                              <td className="px-4 py-3 text-foreground">
                                {column.name}
                              </td>
                              <td className="px-4 py-3 text-muted">
                                {column.dtype}
                              </td>
                              <td className="px-4 py-3 text-muted">
                                {column.role}
                              </td>
                              <td className="px-4 py-3 break-words text-muted">
                                {column.description}
                              </td>
                              <td className="px-4 py-3 text-muted">
                                {column.unit || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      description={dictionary.datasetAnalysis.noItemsLabel}
                      title={dictionary.datasetAnalysis.columnsTableTitle}
                    />
                  )}
                </DataPanel>

                <DataPanel title={dictionary.datasetAnalysis.missingValuesTableTitle}>
                  {result.data.semantic_model.missing_values.length ? (
                    <div className="space-y-3">
                      {result.data.semantic_model.missing_values.map((item) => (
                        <div
                          className="flex items-center justify-between rounded-2xl border border-border bg-surface/60 px-4 py-4"
                          key={item.column}
                        >
                          <span className="text-sm font-medium text-foreground">
                            {item.column}
                          </span>
                          <span className="text-sm text-muted">
                            {formatNumber(item.count, locale)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      description={dictionary.datasetAnalysis.noItemsLabel}
                      title={dictionary.datasetAnalysis.missingValuesTableTitle}
                    />
                  )}
                </DataPanel>
              </div>
            ) : null}

            {activeTab === "run" ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricTile
                    label={dictionary.datasetAnalysis.runStatusLabel}
                    value={result.data.run.status_label ?? result.status}
                  />
                  <MetricTile
                    label={dictionary.datasetAnalysis.createdAtLabel}
                    value={formatTimestamp(job.createdAt, locale)}
                  />
                  <MetricTile
                    label={dictionary.datasetAnalysis.updatedAtLabel}
                    value={formatTimestamp(job.updatedAt, locale)}
                  />
                  <MetricTile
                    label={dictionary.datasetAnalysis.jobIdLabel}
                    value={job.jobId}
                  />
                </div>

                {result.data.run.refinement ? (
                  <JsonPanel
                    title={dictionary.datasetAnalysis.refinementTitle}
                    value={result.data.run.refinement}
                  />
                ) : null}

                <DataPanel title={dictionary.datasetAnalysis.pipelineEventsTitle}>
                  {result.data.run.events.length ? (
                    <div className="space-y-3">
                      {result.data.run.events.map((event, index) => (
                        <div
                          className="rounded-2xl border border-border bg-surface/60 px-4 py-4 text-sm text-muted"
                          key={`${event}-${index}`}
                        >
                          {event}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      description={dictionary.datasetAnalysis.noItemsLabel}
                      title={dictionary.datasetAnalysis.pipelineEventsTitle}
                    />
                  )}
                </DataPanel>

                <JsonPanel
                  title={dictionary.datasetAnalysis.rawEnvelopeTitle}
                  value={result}
                />

                <DataPanel title={dictionary.datasetAnalysis.rawLogTitle}>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-950 px-4 py-4 text-xs leading-6 text-slate-100">
                    {result.data.run.log || "-"}
                  </pre>
                </DataPanel>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
