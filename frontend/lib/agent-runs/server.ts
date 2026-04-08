import "server-only";

import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/auth/supabase-server";
import type { DatasetAnalysisServiceJobResponse } from "@/lib/dataset-analysis/server";

const DATASET_ANALYSIS_AGENT_NAME = "dataset_analysis_orchestrator";
const DATASET_ANALYSIS_TASK_TYPE = "analyze_dataset";

function getDatasetAnalysisRunStatus(
  status: DatasetAnalysisServiceJobResponse["status"]
) {
  return status === "error" ? "failed" : status;
}

function getDatasetAnalysisErrorMessage(job: DatasetAnalysisServiceJobResponse) {
  return (
    job.error?.details ??
    job.error?.message ??
    null
  );
}

function buildDatasetAnalysisInputReference(job: DatasetAnalysisServiceJobResponse) {
  return {
    business_id: job.business_id ?? null,
    dataset_name: job.dataset_name ?? null,
    file_name: job.file_name,
    source_name: job.source_name ?? null,
  };
}

function buildDatasetAnalysisOutputReference(job: DatasetAnalysisServiceJobResponse) {
  const result =
    job.result && typeof job.result === "object" ? job.result : null;
  const resultStatus =
    result && typeof result.status === "string" ? result.status : null;

  return {
    dataset_analysis_job_id: job.job_id,
    dataset_analysis_status: job.status,
    file_name: job.file_name,
    result_status: resultStatus,
  };
}

async function getAgentRunsClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return createServerSupabaseClient();
}

export async function syncDatasetAnalysisAgentRun(input: {
  job: DatasetAnalysisServiceJobResponse;
  businessId?: string | null;
}) {
  const businessId = input.businessId ?? input.job.business_id ?? null;
  if (!businessId) {
    console.warn(
      "Skipping dataset-analysis agent_runs sync because business_id is missing.",
      {
        jobId: input.job.job_id,
      }
    );
    return null;
  }

  const supabase = await getAgentRunsClient();
  const mappedStatus = getDatasetAnalysisRunStatus(input.job.status);
  const finishedAt =
    mappedStatus === "success" || mappedStatus === "failed"
      ? input.job.updated_at ?? new Date().toISOString()
      : null;

  const basePayload = {
    agent_name: DATASET_ANALYSIS_AGENT_NAME,
    business_id: businessId,
    error_message: getDatasetAnalysisErrorMessage(input.job),
    finished_at: finishedAt,
    input_reference: buildDatasetAnalysisInputReference(input.job),
    output_reference: buildDatasetAnalysisOutputReference(input.job),
    status: mappedStatus,
    task_type: DATASET_ANALYSIS_TASK_TYPE,
  };

  const { data: existingRun, error: lookupError } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("business_id", businessId)
    .eq("agent_name", DATASET_ANALYSIS_AGENT_NAME)
    .eq("task_type", DATASET_ANALYSIS_TASK_TYPE)
    .contains("output_reference", {
      dataset_analysis_job_id: input.job.job_id,
    })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existingRun?.id) {
    const { error: updateError } = await supabase
      .from("agent_runs")
      .update(basePayload)
      .eq("id", existingRun.id);

    if (updateError) {
      throw updateError;
    }

    return existingRun.id;
  }

  const startedAt = input.job.created_at ?? new Date().toISOString();
  const { data: insertedRun, error: insertError } = await supabase
    .from("agent_runs")
    .insert({
      id: crypto.randomUUID(),
      ...basePayload,
      created_at: startedAt,
      started_at: startedAt,
    })
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedRun.id;
}
