export type DatasetAnalysisJobStatus =
  | "queued"
  | "running"
  | "success"
  | "error";

export type DatasetAnalysisResultStatus =
  | "success"
  | "partial_success"
  | "error";

export type DatasetAnalysisColumn = {
  name: string;
  dtype: string;
  description: string;
  unit?: string | null;
  role: string;
  [key: string]: unknown;
};

export type DatasetAnalysisActionItem = {
  title: string;
  priority: "High" | "Medium" | "Low";
  what: string;
  why_it_matters: string;
  recommendation: string;
  expected_impact: string;
};

export type DatasetAnalysisQueryResult = {
  question: string;
  query: string;
  result_summary?: string | null;
  explanation: string;
  error?: string | null;
  actual_result?: string | null;
};

export type DatasetAnalysisEnvelope = {
  task_type: "analyze_dataset";
  status: DatasetAnalysisResultStatus;
  data: {
    dataset: {
      file_name: string | null;
      dataset_name: string | null;
      row_count: number;
      column_count: number;
      missing_count: number;
      duplicate_row_count: number;
      memory_kb: number | null;
      preview_rows: Array<Record<string, unknown>>;
    };
    semantic_model: {
      dataset_name: string | null;
      dataset_description: string | null;
      inferred_domain: string | null;
      row_count: number;
      column_count: number;
      time_column: string | null;
      primary_keys: string[];
      date_range: Record<string, string> | null;
      relationships: string[];
      columns: DatasetAnalysisColumn[];
      missing_values: Array<{
        column: string;
        count: number;
      }>;
    };
    questions: {
      dataset_understanding: string | null;
      question_floor: number;
      total: number;
      priority_count: number;
      groups: Record<
        string,
        Array<{
          question: string;
          category: string;
          priority: boolean;
          priority_reason?: string | null;
        }>
      >;
      items: Array<{
        question: string;
        category: string;
        priority: boolean;
        priority_reason?: string | null;
      }>;
    };
    findings: {
      total: number;
      successful_count: number;
      failed_count: number;
      successful: DatasetAnalysisQueryResult[];
      failed: DatasetAnalysisQueryResult[];
    };
    insights: {
      executive_summary: string | null;
      positive_highlights: string[];
      action_items: DatasetAnalysisActionItem[];
      watch_out_for: string[];
    };
    run: {
      log: string | null;
      events: string[];
      refinement: Record<string, unknown> | null;
      status_label: string | null;
    };
  };
  meta: {
    agent: string;
    duration_ms: number;
    model: string;
    question_count: number;
    successful_queries: number;
    failed_queries: number;
    [key: string]: unknown;
  };
  error: {
    code: string;
    message: string;
    details?: string | null;
  } | null;
};

export type DatasetAnalysisJob = {
  jobId: string;
  status: DatasetAnalysisJobStatus;
  createdAt: string;
  updatedAt: string;
  fileName: string;
  datasetName: string | null;
  sourceName: string | null;
  ownerUserId: string | null;
  businessId: string | null;
  result: DatasetAnalysisEnvelope | null;
  error: {
    code?: string;
    message?: string;
    details?: string | null;
  } | null;
};
