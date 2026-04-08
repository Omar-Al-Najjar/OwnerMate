from __future__ import annotations

import asyncio
import datetime as dt
import hashlib
import io
import json
import os
import sys
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, TypedDict

import nest_asyncio
import numpy as np
import pandas as pd
from langgraph.graph import StateGraph
from openai import AsyncOpenAI
from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from dotenv import load_dotenv

nest_asyncio.apply()
load_dotenv(Path(__file__).with_name(".env"))


class PipelineError(Exception):
    """Base error for predictable pipeline failures."""


class ConfigError(PipelineError):
    """Raised when runtime configuration is missing or invalid."""


class ValidationError(PipelineError):
    """Raised when the uploaded dataset cannot be processed safely."""


class ColumnStats(BaseModel):
    mean: Optional[float] = None
    median: Optional[float] = None
    std: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    q1: Optional[float] = None
    q3: Optional[float] = None
    p95: Optional[float] = None
    iqr: Optional[float] = None
    skewness: Optional[float] = None
    zero_count: Optional[int] = None
    negative_count: Optional[int] = None
    unique_count: int
    null_count: int = 0
    null_percentage: float = 0.0
    top_values: Optional[Dict[str, int]] = None


class ColumnSemantics(BaseModel):
    name: str
    dtype: Literal["int", "float", "string", "datetime", "category", "boolean"]
    description: str
    unit: Optional[str] = None
    role: Literal["feature", "target", "id", "time", "category"]
    stats: Optional[ColumnStats] = None
    sample_values: Optional[List[str]] = None
    cardinality: Optional[Literal["unique", "high", "medium", "low"]] = None
    possible_values: Optional[List[str]] = None
    format_hint: Optional[str] = None
    business_domain: Optional[
        Literal["financial", "temporal", "geographic", "operational", "identifier", "status", "other"]
    ] = None
    is_nullable: bool = False
    tags: Optional[List[str]] = None
    relationships: Optional[List[str]] = None


class DatasetSemantics(BaseModel):
    dataset_name: str
    row_count: int
    column_count: int = 0
    columns: List[ColumnSemantics]
    primary_keys: List[str]
    time_column: Optional[str]
    missing_values: Dict[str, int]
    inferred_domain: Optional[str] = None
    duplicate_row_count: int = 0
    date_range: Optional[Dict[str, str]] = None
    inter_column_relationships: Optional[List[str]] = None
    dataset_description: Optional[str] = None
    numeric_correlations: Optional[Dict[str, Dict[str, float]]] = None


class AnalyticalQuestion(BaseModel):
    question: str
    category: str
    priority: bool = False
    priority_reason: Optional[str] = None


class AnalyticalQuestionsOutput(BaseModel):
    dataset_understanding: str
    questions: List[AnalyticalQuestion]


class QueryResult(BaseModel):
    question: str
    query: str
    result_summary: str
    explanation: str
    error: Optional[str] = None
    actual_result: Optional[str] = None


class SQLAgentOutput(BaseModel):
    answers: List[QueryResult]


class ActionItem(BaseModel):
    title: str
    priority: Literal["High", "Medium", "Low"]
    what: str
    why_it_matters: str
    recommendation: str
    expected_impact: str


class BusinessInsightsOutput(BaseModel):
    executive_summary: str
    positive_highlights: List[str]
    action_items: List[ActionItem]
    watch_out_for: List[str]


class RefinementDecision(BaseModel):
    approved: bool
    feedback: str
    failed_questions: Optional[List[str]] = None
    reasoning: str


class MasterState(TypedDict):
    semantic_model: Optional[DatasetSemantics]
    questions: Optional[AnalyticalQuestionsOutput]
    answers: Optional[List[QueryResult]]
    insights: Optional[BusinessInsightsOutput]
    refinement: Optional[RefinementDecision]
    question_floor: int
    sql_retry_count: int
    insights_retry_count: int
    question_retry_count: int
    refinement_feedback: Optional[str]
    refinement_failed_questions: Optional[List[str]]
    pipeline_log: List[str]
    _next: str


@dataclass(frozen=True)
class RuntimeConfig:
    api_key: str
    model: str
    base_url: str
    temperature: float
    agent_timeout: Optional[int]
    agent_retries: int
    batch_size: int
    sql_heal_retries: int
    max_retries: int
    trim_chars: int
    disable_thinking: bool


PRIORITY_ORDER = {"High": 0, "Medium": 1, "Low": 2}
DEFAULT_MODEL = "kimi-k2.5"
DEFAULT_BASE_URL = "https://api.moonshot.ai/v1"
DEFAULT_TEMPERATURE = 0.6
DEFAULT_TASK_TYPE = "analyze_dataset"
DEFAULT_AGENT_NAME = "dataset_analysis_orchestrator"

_SEMANTIC_CACHE: dict[str, DatasetSemantics] = {}
_AGENTS_CACHE: dict[tuple[str, str, bool], dict[str, Agent]] = {}


def _as_bool(raw: Optional[str], default: bool = True) -> bool:
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _is_overload_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return (
        "429" in message
        or "rate limit" in message
        or "too many requests" in message
        or "overloaded" in message
        or "engine_overloaded_error" in message
    )


def _retry_wait_seconds(exc: Exception, attempt: int) -> int:
    if _is_overload_error(exc):
        return min(30 * (2 ** (attempt - 1)), 300)
    return 5 * attempt


def _retry_limit_for_exception(config: RuntimeConfig, exc: Exception) -> int:
    if _is_overload_error(exc):
        return max(config.agent_retries, 6)
    return config.agent_retries


def _to_json_safe(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return value.isoformat()
    if value is pd.NA:
        return None
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, dict):
        return {str(key): _to_json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_to_json_safe(item) for item in value]
    return value


def _json_dumps(payload: Any) -> str:
    return json.dumps(_to_json_safe(payload))


def get_runtime_config() -> RuntimeConfig:
    api_key = os.getenv("OWNERMATE_LLM_API_KEY")
    if not api_key:
        raise ConfigError("Missing `OWNERMATE_LLM_API_KEY` environment variable.")
    raw_agent_timeout = os.getenv("OWNERMATE_AGENT_TIMEOUT", "120").strip()
    parsed_agent_timeout = int(raw_agent_timeout)
    return RuntimeConfig(
        api_key=api_key,
        model=os.getenv("OWNERMATE_LLM_MODEL", DEFAULT_MODEL),
        base_url=os.getenv("OWNERMATE_LLM_BASE_URL", DEFAULT_BASE_URL),
        temperature=float(os.getenv("OWNERMATE_LLM_TEMPERATURE", str(DEFAULT_TEMPERATURE))),
        agent_timeout=parsed_agent_timeout if parsed_agent_timeout > 0 else None,
        agent_retries=int(os.getenv("OWNERMATE_AGENT_RETRIES", "3")),
        batch_size=int(os.getenv("OWNERMATE_BATCH_SIZE", "5")),
        sql_heal_retries=int(os.getenv("OWNERMATE_SQL_HEAL_RETRIES", "2")),
        max_retries=int(os.getenv("OWNERMATE_REFINEMENT_RETRIES", "2")),
        trim_chars=int(os.getenv("OWNERMATE_RESULT_TRIM_CHARS", "6000")),
        disable_thinking=_as_bool(os.getenv("OWNERMATE_DISABLE_THINKING"), default=True),
    )


def get_runtime_summary() -> dict[str, Any]:
    raw_agent_timeout = os.getenv("OWNERMATE_AGENT_TIMEOUT", "120").strip()
    parsed_agent_timeout = int(raw_agent_timeout)
    return {
        "api_key_configured": bool(os.getenv("OWNERMATE_LLM_API_KEY")),
        "model": os.getenv("OWNERMATE_LLM_MODEL", DEFAULT_MODEL),
        "base_url": os.getenv("OWNERMATE_LLM_BASE_URL", DEFAULT_BASE_URL),
        "temperature": float(os.getenv("OWNERMATE_LLM_TEMPERATURE", str(DEFAULT_TEMPERATURE))),
        "batch_size": int(os.getenv("OWNERMATE_BATCH_SIZE", "5")),
        "agent_timeout": parsed_agent_timeout if parsed_agent_timeout > 0 else None,
    }


def _profile_column(column: str, series: pd.Series) -> tuple[str, dict[str, Any]]:
    null_count = int(series.isnull().sum())
    unique_count = int(series.nunique(dropna=True))
    sample_values = [str(value) for value in series.dropna().unique()[:5]]
    top_values = None

    if series.dtype == object or unique_count <= 50:
        top_values = {
            str(key): int(value)
            for key, value in series.value_counts(dropna=True).head(10).items()
        }

    stats: dict[str, Any] = {
        "unique_count": unique_count,
        "null_count": null_count,
        "null_percentage": round((null_count / len(series) * 100), 2) if len(series) else 0,
        "top_values": top_values,
    }

    if pd.api.types.is_numeric_dtype(series):
        clean = series.dropna()
        q1 = float(clean.quantile(0.25)) if len(clean) else None
        q3 = float(clean.quantile(0.75)) if len(clean) else None
        stats.update(
            {
                "mean": float(series.mean()) if len(clean) else None,
                "median": float(series.median()) if len(clean) else None,
                "std": float(series.std()) if len(clean) else None,
                "min": float(series.min()) if len(clean) else None,
                "max": float(series.max()) if len(clean) else None,
                "q1": q1,
                "q3": q3,
                "p95": float(clean.quantile(0.95)) if len(clean) else None,
                "iqr": round(q3 - q1, 6) if q1 is not None and q3 is not None else None,
                "skewness": float(clean.skew()) if len(clean) else None,
                "zero_count": int((series == 0).sum()),
                "negative_count": int((series < 0).sum()),
            }
        )

    return column, {"dtype": str(series.dtype), "stats": stats, "sample_values": sample_values}


def profile_dataframe(df: pd.DataFrame) -> dict[str, Any]:
    profile: dict[str, Any] = {"columns": {}}
    with ThreadPoolExecutor() as executor:
        for column, column_profile in executor.map(lambda c: _profile_column(c, df[c]), df.columns):
            profile["columns"][column] = column_profile

    numeric_cols = [
        column
        for column in df.columns
        if pd.api.types.is_numeric_dtype(df[column])
        and not pd.api.types.is_bool_dtype(df[column])
    ]
    profile["numeric_correlations"] = (
        df[numeric_cols].corr().round(3).to_dict() if len(numeric_cols) >= 2 else {}
    )
    profile["missing"] = {key: int(value) for key, value in df.isnull().sum().items()}
    profile["row_count"] = len(df)
    profile["column_count"] = len(df.columns)
    profile["duplicate_row_count"] = int(df.duplicated().sum())
    return profile


def validate_semantics(semantics: DatasetSemantics, df: pd.DataFrame) -> DatasetSemantics:
    df_columns = set(df.columns)
    valid_columns = [column for column in semantics.columns if column.name in df_columns]
    seen = {column.name for column in valid_columns}

    for column_name in df.columns:
        if column_name in seen:
            continue
        series = df[column_name]
        dtype: Literal["int", "float", "string", "datetime", "category", "boolean"]
        if pd.api.types.is_bool_dtype(series):
            dtype = "boolean"
        elif pd.api.types.is_integer_dtype(series):
            dtype = "int"
        elif pd.api.types.is_float_dtype(series):
            dtype = "float"
        else:
            dtype = "string"
        valid_columns.append(
            ColumnSemantics(
                name=column_name,
                dtype=dtype,
                description=f"Column '{column_name}' added as a fallback stub during validation.",
                role="feature",
                stats=ColumnStats(
                    unique_count=int(series.nunique(dropna=True)),
                    null_count=int(series.isnull().sum()),
                    null_percentage=round(series.isnull().mean() * 100, 2),
                ),
                is_nullable=bool(series.isnull().any()),
            )
        )

    primary_keys = [key for key in semantics.primary_keys if key in df_columns]
    time_column = semantics.time_column if semantics.time_column in df_columns else None
    return semantics.model_copy(
        update={
            "columns": valid_columns,
            "primary_keys": primary_keys,
            "time_column": time_column,
            "row_count": len(df),
            "column_count": len(df.columns),
            "missing_values": {key: int(value) for key, value in df.isnull().sum().items()},
            "duplicate_row_count": int(df.duplicated().sum()),
        }
    )


def question_floor(semantic: DatasetSemantics) -> int:
    analysable = [column for column in semantic.columns if column.role != "id"]
    floor = len(analysable) * 2
    floor += 4 if semantic.time_column else 0
    floor += sum(
        2
        for column in semantic.columns
        if column.role == "category" and column.cardinality in ("low", "medium")
    )
    correlation_pairs = 0
    if semantic.numeric_correlations:
        columns = list(semantic.numeric_correlations.keys())
        for index, left in enumerate(columns):
            for right in columns[index + 1 :]:
                if abs(semantic.numeric_correlations[left].get(right, 0)) > 0.3:
                    correlation_pairs += 1
    floor += min(correlation_pairs, 10)
    return max(10, floor)


def _similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, left.lower().strip(), right.lower().strip()).ratio()


def dedup_questions(questions: List[AnalyticalQuestion], threshold: float = 0.72) -> tuple[List[AnalyticalQuestion], int]:
    kept: List[AnalyticalQuestion] = []
    removed = 0
    for candidate in questions:
        is_duplicate = False
        for index, existing in enumerate(kept):
            if _similarity(candidate.question, existing.question) >= threshold:
                if candidate.priority and not existing.priority:
                    kept[index] = candidate
                is_duplicate = True
                removed += 1
                break
        if not is_duplicate:
            kept.append(candidate)
    return kept, removed


def dedup_actions(items: List[ActionItem], threshold: float = 0.70) -> tuple[List[ActionItem], int]:
    def fingerprint(item: ActionItem) -> str:
        return (item.title + " " + item.what[:120]).lower()

    kept: List[ActionItem] = []
    removed = 0
    for candidate in items:
        is_duplicate = False
        for index, existing in enumerate(kept):
            if _similarity(fingerprint(candidate), fingerprint(existing)) >= threshold:
                if PRIORITY_ORDER.get(candidate.priority, 99) < PRIORITY_ORDER.get(existing.priority, 99):
                    kept[index] = candidate
                is_duplicate = True
                removed += 1
                break
        if not is_duplicate:
            kept.append(candidate)
    return kept, removed


def _format_result(result: Any, trim_chars: int) -> str:
    def _trim_table(table: Any) -> str:
        full = table.to_string()
        if len(full) <= trim_chars:
            return full
        for rows in range(len(table) - 1, 0, -1):
            chunk = table.iloc[:rows].to_string()
            if len(chunk) <= trim_chars - 80:
                return chunk + f"\n[RESULT TRUNCATED - {len(table) - rows} rows hidden]"
        return table.iloc[:1].to_string() + f"\n[RESULT TRUNCATED - {len(table) - 1} rows hidden]"

    if isinstance(result, pd.DataFrame):
        return _trim_table(result)
    if isinstance(result, pd.Series):
        return _trim_table(result)
    result_text = str(result)
    if len(result_text) <= trim_chars:
        return result_text
    return result_text[:trim_chars] + "\n[RESULT TRUNCATED]"


def _is_empty(result: Any) -> bool:
    if result is None:
        return True
    if isinstance(result, (int, float)):
        return bool(np.isnan(result))
    if isinstance(result, pd.Series):
        return result.empty or result.isna().all()
    if isinstance(result, pd.DataFrame):
        return result.empty or result.isna().all().all()
    return False


def _execute(query: str, df: pd.DataFrame) -> tuple[Any, Optional[str]]:
    try:
        local_ns = {"df": df, "pd": pd, "np": np}
        exec(query, {"__builtins__": __builtins__}, local_ns)
        result = local_ns.get("result")
        if result is None:
            return None, "Script did not assign a `result` variable."
        if _is_empty(result):
            return None, f"Empty result: {result!r}"
        return result, None
    except Exception as exc:
        return None, str(exc)


def _safe_dataset_name(dataset_name: Optional[str], source_name: Optional[str]) -> str:
    if dataset_name and dataset_name.strip():
        return dataset_name.strip()
    if source_name and source_name.strip():
        stem, _, _ = source_name.rpartition(".")
        base = stem or source_name
        return base.replace("_", " ").replace("-", " ").strip() or "uploaded dataset"
    return "uploaded dataset"


def _validate_dataframe(df: pd.DataFrame) -> None:
    if df is None:
        raise ValidationError("No dataframe was provided.")
    if not isinstance(df, pd.DataFrame):
        raise ValidationError("Expected a pandas DataFrame.")
    if df.empty:
        raise ValidationError("The uploaded CSV is empty.")
    if len(df.columns) == 0:
        raise ValidationError("The uploaded CSV has no columns.")


def _build_empty_data(source_name: Optional[str] = None) -> dict[str, Any]:
    return {
        "dataset": {
            "file_name": source_name,
            "dataset_name": None,
            "row_count": 0,
            "column_count": 0,
            "missing_count": 0,
            "duplicate_row_count": 0,
            "memory_kb": None,
            "preview_rows": [],
        },
        "semantic_model": {
            "dataset_name": None,
            "dataset_description": None,
            "inferred_domain": None,
            "row_count": 0,
            "column_count": 0,
            "time_column": None,
            "primary_keys": [],
            "date_range": None,
            "relationships": [],
            "columns": [],
            "missing_values": [],
        },
        "questions": {
            "dataset_understanding": None,
            "question_floor": 0,
            "total": 0,
            "priority_count": 0,
            "groups": {},
            "items": [],
        },
        "findings": {
            "total": 0,
            "successful_count": 0,
            "failed_count": 0,
            "successful": [],
            "failed": [],
        },
        "insights": {
            "executive_summary": None,
            "positive_highlights": [],
            "action_items": [],
            "watch_out_for": [],
        },
        "run": {
            "log": "",
            "events": [],
            "refinement": None,
            "status_label": None,
        },
    }


def _build_error_envelope(
    *,
    code: str,
    message: str,
    source_name: Optional[str] = None,
    status: str = "error",
    duration_ms: int = 0,
    model: Optional[str] = None,
    details: Optional[str] = None,
) -> dict[str, Any]:
    runtime = get_runtime_summary()
    return {
        "task_type": DEFAULT_TASK_TYPE,
        "status": status,
        "data": _build_empty_data(source_name),
        "meta": {
            "agent": DEFAULT_AGENT_NAME,
            "duration_ms": duration_ms,
            "model": model or runtime["model"],
            "question_count": 0,
            "successful_queries": 0,
            "failed_queries": 0,
            "api_key_configured": runtime["api_key_configured"],
        },
        "error": {
            "code": code,
            "message": message,
            "details": details,
        },
    }


def _serialize_semantic_model(semantic_model: Optional[DatasetSemantics]) -> dict[str, Any]:
    if not semantic_model:
        return _build_empty_data()["semantic_model"]
    return _to_json_safe({
        "dataset_name": semantic_model.dataset_name,
        "dataset_description": semantic_model.dataset_description,
        "inferred_domain": semantic_model.inferred_domain,
        "row_count": semantic_model.row_count,
        "column_count": semantic_model.column_count,
        "time_column": semantic_model.time_column,
        "primary_keys": semantic_model.primary_keys,
        "date_range": semantic_model.date_range,
        "relationships": semantic_model.inter_column_relationships or [],
        "columns": [column.model_dump() for column in semantic_model.columns],
        "missing_values": [
            {"column": key, "count": value}
            for key, value in (semantic_model.missing_values or {}).items()
            if value > 0
        ],
    })


def _serialize_questions(questions: Optional[AnalyticalQuestionsOutput], floor: int) -> dict[str, Any]:
    if not questions:
        payload = _build_empty_data()["questions"]
        payload["question_floor"] = floor
        return payload
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in questions.questions:
        grouped[item.category].append(item.model_dump())
    items = [item.model_dump() for item in questions.questions]
    return _to_json_safe({
        "dataset_understanding": questions.dataset_understanding,
        "question_floor": floor,
        "total": len(items),
        "priority_count": sum(1 for item in questions.questions if item.priority),
        "groups": dict(grouped),
        "items": items,
    })


def _serialize_findings(answers: Optional[List[QueryResult]]) -> dict[str, Any]:
    if not answers:
        return _build_empty_data()["findings"]
    successful = []
    failed = []
    for answer in answers:
        item = answer.model_dump()
        if answer.error:
            failed.append(item)
        else:
            successful.append(item)
    return _to_json_safe({
        "total": len(answers),
        "successful_count": len(successful),
        "failed_count": len(failed),
        "successful": successful,
        "failed": failed,
    })


def _serialize_insights(insights: Optional[BusinessInsightsOutput]) -> dict[str, Any]:
    if not insights:
        return _build_empty_data()["insights"]
    return _to_json_safe({
        "executive_summary": insights.executive_summary,
        "positive_highlights": insights.positive_highlights,
        "action_items": [item.model_dump() for item in insights.action_items],
        "watch_out_for": insights.watch_out_for,
    })


def _serialize_refinement(refinement: Optional[RefinementDecision]) -> Optional[dict[str, Any]]:
    if not refinement:
        return None
    return _to_json_safe(refinement.model_dump())


def _build_dataset_section(df: pd.DataFrame, dataset_name: str, source_name: Optional[str]) -> dict[str, Any]:
    return _to_json_safe({
        "file_name": source_name,
        "dataset_name": dataset_name,
        "row_count": len(df),
        "column_count": len(df.columns),
        "missing_count": int(df.isnull().sum().sum()),
        "duplicate_row_count": int(df.duplicated().sum()),
        "memory_kb": round(float(df.memory_usage(deep=True).sum()) / 1024, 1),
        "preview_rows": df.head(10).to_dict(orient="records"),
    })


def _build_success_envelope(
    raw_result: dict[str, Any],
    *,
    df: pd.DataFrame,
    dataset_name: str,
    source_name: Optional[str],
    duration_ms: int,
    log_text: str,
    config: RuntimeConfig,
) -> dict[str, Any]:
    semantic_model: Optional[DatasetSemantics] = raw_result.get("semantic_model")
    questions: Optional[AnalyticalQuestionsOutput] = raw_result.get("questions")
    answers: Optional[List[QueryResult]] = raw_result.get("answers")
    insights: Optional[BusinessInsightsOutput] = raw_result.get("insights")
    refinement: Optional[RefinementDecision] = raw_result.get("refinement")
    findings = _serialize_findings(answers)
    failed_count = findings["failed_count"]
    status = "partial_success" if failed_count > 0 else "success"
    status_label = "Approved"
    if refinement and not refinement.approved:
        status_label = "Completed with unresolved refinement feedback"
    elif failed_count > 0:
        status_label = "Completed with failed query fallbacks"

    return _to_json_safe({
        "task_type": DEFAULT_TASK_TYPE,
        "status": status,
        "data": {
            "dataset": _build_dataset_section(df, dataset_name, source_name),
            "semantic_model": _serialize_semantic_model(semantic_model),
            "questions": _serialize_questions(questions, raw_result.get("question_floor", 0)),
            "findings": findings,
            "insights": _serialize_insights(insights),
            "run": {
                "log": log_text,
                "events": raw_result.get("pipeline_log") or [],
                "refinement": _serialize_refinement(refinement),
                "status_label": status_label,
            },
        },
        "meta": {
            "agent": DEFAULT_AGENT_NAME,
            "duration_ms": duration_ms,
            "model": config.model,
            "question_count": findings["total"],
            "successful_queries": findings["successful_count"],
            "failed_queries": findings["failed_count"],
            "api_key_configured": True,
        },
        "error": None,
    })


def _semantic_prompt() -> str:
    return """
You are an expert data architect who builds rich, detailed semantic layers from raw profiling data.

INPUT:
You receive a JSON object with:
- dataset_name
- profile.columns: per-column dtype, stats (mean/median/std/min/max/q1/q3/p95/iqr/skewness/
  zero_count/negative_count/unique_count/null_count/null_percentage/top_values), and sample_values
- profile.row_count, column_count, duplicate_row_count, missing (null counts per column)
- profile.numeric_correlations: cross-column Pearson correlation matrix for numeric columns

YOUR TASK - fill every field of DatasetSemantics as completely as possible:

name          : exact column name from input (never hallucinate)
dtype         : 'int' | 'float' | 'string' | 'datetime' | 'category' | 'boolean'
description   : 1-2 sentence plain-English business context explanation
unit          : currency code (e.g. 'JOD'), unit of measurement, or null
role          : 'id' | 'time' | 'feature' | 'target' | 'category'
stats         : copy ALL numeric fields from the profile - NEVER fabricate numbers
sample_values : copy from profile.columns[col].sample_values
cardinality   : 'unique' / 'high' / 'medium' / 'low' based on unique_count vs row_count
possible_values: all distinct values for low-cardinality columns
format_hint   : detected format pattern (e.g. '%d/%m/%Y %H:%M', 'JO-YYYY-NNNN-NNNNN')
business_domain: 'financial' | 'temporal' | 'geographic' | 'operational' | 'identifier' | 'status' | 'other'
is_nullable   : true if null_count > 0
tags          : 2-5 short descriptive labels
relationships : use numeric_correlations to note strong correlations (|r| > 0.5)

DATASET-LEVEL:
dataset_name, row_count, column_count, primary_keys, time_column, missing_values,
inferred_domain, duplicate_row_count, date_range, inter_column_relationships, dataset_description

RULES:
- NEVER create columns not in profile.columns
- NEVER fabricate statistics
- Fill every optional field where data supports it
- Use numeric_correlations to enrich inter_column_relationships and column relationships fields
"""


def _question_prompt() -> str:
    return """
You are a senior data analyst and analytical strategist.
Your sole job is to generate exhaustive, high-quality analytical questions for a downstream SQL agent.
You do NOT analyze results. You do NOT provide insights. You do NOT generate SQL.

INPUT:
- semantic_model: full dataset semantic model (columns, types, roles, stats, correlations)
- dataframe_sample: first 5 rows of actual data
- question_floor: the MINIMUM number of questions - treat this as a floor, not a target
- refinement_feedback (optional): specific issues to fix from the quality checker

COVERAGE POLICY - NON-NEGOTIABLE:
Your goal is COMPLETE analytical coverage of the dataset, not hitting a number.
Go through every element listed below and generate at least one question for each
angle the data actually supports. A richer dataset will produce more questions naturally.
Do NOT stop early to stay near question_floor - stop only when you have covered everything.

SYSTEMATIC COVERAGE CHECKLIST - work through each in order:

1. COLUMNS (one pass per column):
   - For every numeric column: distribution shape, outliers, zero/negative counts if relevant
   - For every category/status column: value breakdown, dominant vs rare values
   - For every time column: trend over time, seasonality, period-over-period change
   - For every ID/key column: uniqueness, duplicate detection

2. SEGMENTATION (cross every category against every metric):
   - For each category column x each numeric column: how does the metric differ by segment?
   - Which segment ranks highest / lowest on each KPI?
   - Are there segments with unexpectedly high failure, refund, or error rates?

3. CORRELATIONS (from numeric_correlations, |r| > 0.3):
   - For each notable correlation pair: does the relationship hold across segments?
   - Are there pairs where correlation is strong in one segment but weak in another?

4. TRENDS (only if a time column exists):
   - Overall trend for each numeric KPI
   - Month-over-month / week-over-week change rates
   - Which segments are growing vs declining?
   - Are there sudden drops or spikes at specific time periods?

5. PERFORMANCE & RANKING:
   - Rank every segment by every key metric
   - Identify top and bottom performers
   - What separates the best-performing segment from the worst?

6. DATA QUALITY:
   - Missing value patterns - are nulls concentrated in certain segments or time periods?
   - Duplicate records
   - Outliers (values beyond 3x IQR or p95)
   - Zero-value anomalies in columns that should always be positive

7. BEHAVIORAL / OPERATIONAL:
   - Frequency distributions (how often do events occur?)
   - Any columns that suggest process steps or funnels - where do drop-offs occur?
   - Time-of-day or day-of-week patterns if datetime granularity supports it

QUESTION RULES:
- Reference ONLY columns listed in semantic_model.columns - never hallucinate column names
- Every question must be specific and directly translatable to a single pandas expression
- Every question must lead to a genuinely useful business insight
- Phrase questions as: What / Which / How many / How does / Compare / Rank / Is there / etc.
- No near-identical questions - each must cover a distinct analytical angle
- Do NOT generate SQL or pandas code

PRIORITISATION:
Mark the most impactful questions as priority=true with a priority_reason.
Priority questions are those where the answer could directly change a business decision.
There is no cap on how many questions can be priority - mark as many as genuinely deserve it.
"""


def _sql_prompt() -> str:
    return """
You are an expert data analyst who answers analytical questions by writing pandas scripts.

INPUT:
- questions: list of analytical questions to answer
- semantic_model: full semantic model (column names, types, roles, stats, format hints)
- schema: condensed column list for quick reference
- dataframe_sample: first 5 rows of actual data
- retry_feedback (optional): errors from previous attempts - fix these exactly

For EACH question produce:
1. query: a multi-line Python script using `df`, `pd`, `np`.
   The script MUST assign the final answer to a variable called `result`.
   You MAY use as many intermediate steps as needed for clarity and correctness.
   Good examples:

     # Simple aggregation
     result = df.groupby('category')['revenue'].sum().sort_values(ascending=False).head(10)

     # Multi-step: parse dates then aggregate
     dates = pd.to_datetime(df['date'], format='%d/%m/%Y %H:%M', errors='coerce')
     failed = df[df['status'] == 'Failed'].copy()
     result = failed.groupby(dates[failed.index].dt.to_period('M')).size()

     # Correlation with filtering
     clean = df[['col_a', 'col_b']].dropna()
     result = clean.corr()

     # Ranked segment summary
     grp = df.groupby('region').agg(total=('amount', 'sum'), count=('id', 'count'))
     result = grp.sort_values('total', ascending=False)

2. result_summary: Write EXACTLY: "PENDING: result will be computed by executing the query above."
   DO NOT invent numbers - actual results replace this field automatically.

3. explanation: 1-2 sentences on business relevance. No specific numbers.

RULES:
- Only use columns in semantic_model.columns
- `df`, `pd`, `np` are pre-defined - do NOT import or redefine them
- The last statement MUST be `result = <expression>` - nothing after it
- Parse dates with pd.to_datetime(..., errors='coerce') and store in an intermediate var
- If a question requires multiple groupbys or filters, use intermediate variables freely
- If unanswerable with this schema: set error field, leave query empty
- Return exactly one answer per question - no skipping
"""


def _insights_prompt() -> str:
    return """
You are a trusted business advisor translating data analysis into clear, actionable guidance
for a business owner with no technical background.

INPUT:
- semantic_model: full dataset semantic model
- dataset_understanding: summary of the dataset
- qa_pairs: answered questions, each with actual_result (the real data) and explanation
- pipeline_context_log: chronological narrative of every stage completed so far
- refinement_feedback (optional): specific issues to fix

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NUMBERS POLICY - ABSOLUTE, NON-NEGOTIABLE RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. EVERY number, percentage, count, amount, ratio, or metric you write MUST
   be copied verbatim from an actual_result field in qa_pairs.
2. NEVER invent, estimate, round, extrapolate, or approximate any number.
   If you did not see the exact number in actual_result, do NOT write it.
3. NEVER use numbers from the explanation field - explanations may contain
   estimates. Use ONLY actual_result.
4. If actual_result is null or the query errored, write "data unavailable"
   and make NO numeric claim about that question.
5. Before writing any number, ask yourself: "Can I point to the exact row
   in actual_result where this number appears?" If NO - remove it.
6. Fabricating or estimating numbers is a critical failure.
7. If actual_result contains [RESULT TRUNCATED - N rows hidden], only numbers
   that are VISIBLE in the shown portion are verified. For any number from a
   truncated result that you cannot see explicitly, write "data unavailable"
   - do NOT infer, extrapolate, or fill in hidden rows from memory.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COVERAGE POLICY - NON-NEGOTIABLE:
- Go through EVERY qa_pair that has a non-null actual_result.
- Every meaningful finding must appear somewhere in the report.
- Do NOT skip or summarise away findings just to keep the report short.
- The dataset determines how much there is to say. A rich dataset produces
  a long report. A sparse dataset produces a short one. Both are correct.

OUTPUT - produce ALL four sections:

1. executive_summary:
   A flowing narrative that covers the full picture - both strengths AND problems.
   - Open with the single most important positive finding.
   - Cover key risks, failures, and anomalies found in the data.
   - Include specific numbers traced directly to actual_result wherever relevant.
   - Mention top-performing and underperforming segments.
   - Close with the top-priority action the owner must take TODAY.
   - Length scales with the data: write as many sentences as the findings require.

2. positive_highlights:
   One item per genuinely positive finding in the data - celebrate everything that is working.
   - Each item must include at least one number from actual_result.
   - Do not cap this list; if there are 12 positives, write 12.
   - Do not pad with vague praise if the data does not support it.

3. action_items:
   One item per distinct actionable problem or opportunity found in the data.
   - Cover every problem AND every opportunity the data reveals - do not merge
     unrelated findings just to keep the list short.
   - For each item:
       title: short and specific (name the metric / branch / segment)
       priority: High (revenue/failure impact), Medium (performance gap), Low (monitoring/scaling)
       what: as many sentences as needed. Every number MUST exist verbatim in actual_result.
       why_it_matters: business consequence if ignored OR opportunity missed.
       recommendation: 2-3 concrete, specific next steps - no vague advice.
       expected_impact: use numbers from actual_result; say "see data" if unavailable.
   - Ensure a mix of High, Medium, and Low priorities reflecting the actual data.
   - Write DISTINCT items - do NOT restate the same finding under different titles.

4. watch_out_for:
   One warning per risk or anomaly visible in the data.
   - Cover every threshold, outlier, or declining trend found across ALL qa_pairs.
   - Every threshold cited must come from actual_result - do not invent alert levels.
   - Do not cap this list; write as many warnings as the data warrants.

TONE: Direct, warm, specific. Celebrate wins openly. No jargon. Plain language.
"""


def _sql_checker_prompt() -> str:
    return """
You are a quality checker for a data analysis pipeline.
Review the SQL execution results and decide if they are good enough for the insights stage.

INPUT:
- semantic_model: full dataset semantic model
- answers: executed query results with question, query, actual_result, error, priority flag

CHECKS:
1. SUCCESS RATE: >= 80% of questions answered (no error, non-empty result). Below 80% = fail.
2. PRIORITY COVERAGE: Did all priority=true questions succeed? Any priority failure = fail.
3. RESULT QUALITY: Do actual_result values look real? Empty series / all-NaN = fail.
4. QUERY LOGIC: Do queries actually answer what was asked?
5. TRUNCATION: If actual_result contains [RESULT TRUNCATED - N rows hidden], flag this
   question in your feedback so it can be rewritten to return a more compact result
   (e.g. aggregated summary instead of raw rows). Do NOT fail the whole batch for this
   alone - just note it so the SQL agent can fix the query on retry.

DECISION:
- approved=true: >=80% success, all priority questions answered, results meaningful
- approved=false: set failed_questions (list of question strings) + specific feedback

Ground truth is ALWAYS actual_result - never result_summary.
Do NOT fail a result that ran and returned real data just because result_summary says PENDING.
"""


def _refinement_prompt() -> str:
    return """
You are a quality checker for a data analysis pipeline.
Review the business insights report and decide if it is good enough to present to the owner.

INPUT:
- semantic_model: full dataset semantic model
- qa_pairs: SQL results (questions + actual_result)
- insights: the generated business insights report

YOUR ONLY JOB: verify quality, not quantity.
Different datasets produce different amounts of content. A simple dataset may have
3 action items; a complex one may have 15. Both can be correct. Never fail a report
solely because a section has fewer or more items than some fixed number.

CHECKS (in order of importance):

1. NUMBER GROUNDING (CRITICAL - the only automatic fail):
   - For every number, percentage, count, amount, or ratio that appears anywhere
     in the report, scan ALL actual_result fields in qa_pairs for an exact match.
   - If ANY number cannot be found verbatim in actual_result -> fail, and list
     each unverified number and exactly where it appears.
   - Numbers from the explanation field do NOT count as a valid source.
   - Rounded or approximated values that differ from actual_result -> fail.
   - If actual_result for a question is null/errored, any number claimed from
     that question is automatically fabricated -> fail.
   - If actual_result contains [RESULT TRUNCATED - N rows hidden], only numbers
     visible in the shown portion are valid sources. Any number from a hidden
     row that appears in the report is an automatic fail - treat it as fabricated.

2. COVERAGE:
   - Does the report address every qa_pair that returned a non-null actual_result?
   - A meaningful finding that is completely absent from the report -> fail.
   - Minor omissions or slight de-emphasis are acceptable.

3. SPECIFICITY:
   - Are recommendations concrete and actionable? "Consider improving" with no
     further detail = vague = fail.
   - At least one concrete next step per action item is required.

4. FABRICATION CHECK:
   - Are there numbers that look invented (suspiciously round estimates, percentages
     with no query to support them)? If yes -> fail.

DECISION:
- approved=true: number grounding passes, all key findings covered, recommendations specific.
- approved=false: ONLY for number grounding failures, clear fabrication, missing key findings,
  or fully vague recommendations. List the exact issues found.

Do NOT fail a report for:
- Having fewer or more items than an arbitrary target.
- Minor stylistic issues or slightly soft wording in one sentence.
- Section lengths that differ from a template.

Be a fair reviewer, not a perfectionist. If the content is grounded and covers the data, approve it.
"""


def get_agents(config: RuntimeConfig) -> dict[str, Agent]:
    cache_key = (config.base_url, config.model, config.disable_thinking)
    if cache_key in _AGENTS_CACHE:
        return _AGENTS_CACHE[cache_key]

    client = AsyncOpenAI(api_key=config.api_key, base_url=config.base_url)
    provider = OpenAIProvider(openai_client=client)
    model = OpenAIChatModel(config.model, provider=provider)
    settings: dict[str, Any] = {"temperature": config.temperature}
    if config.disable_thinking:
        settings["extra_body"] = {"thinking": {"type": "disabled"}}

    def build_agent(output_type: Any, prompt: str) -> Agent:
        return Agent(
            model=model,
            model_settings=settings,
            output_type=output_type,
            system_prompt=prompt,
        )

    agents = {
        "semantic": build_agent(DatasetSemantics, _semantic_prompt()),
        "question": build_agent(AnalyticalQuestionsOutput, _question_prompt()),
        "sql": build_agent(SQLAgentOutput, _sql_prompt()),
        "insights": build_agent(BusinessInsightsOutput, _insights_prompt()),
        "sql_checker": build_agent(RefinementDecision, _sql_checker_prompt()),
        "refinement": build_agent(RefinementDecision, _refinement_prompt()),
    }
    _AGENTS_CACHE[cache_key] = agents
    return agents


async def _call(agent: Agent, prompt: str, label: str, config: RuntimeConfig) -> Any:
    attempt = 1
    while True:
        try:
            run_coro = agent.run(prompt)
            if config.agent_timeout is None:
                return await run_coro
            return await asyncio.wait_for(run_coro, timeout=config.agent_timeout)
        except asyncio.TimeoutError:
            if attempt == config.agent_retries:
                raise RuntimeError(f"[{label}] timed out after {config.agent_retries} attempts")
            wait_seconds = 5 * attempt
            print(f"  [{label}] timed out, retrying in {wait_seconds}s...")
            await asyncio.sleep(wait_seconds)
        except Exception as exc:
            retry_limit = _retry_limit_for_exception(config, exc)
            if attempt >= retry_limit:
                raise
            wait_seconds = _retry_wait_seconds(exc, attempt)
            reason = "provider overload" if _is_overload_error(exc) else "error"
            print(
                f"  [{label}] {reason}: {exc} - retrying in {wait_seconds}s "
                f"(attempt {attempt + 1}/{retry_limit})..."
            )
            await asyncio.sleep(wait_seconds)
        attempt += 1


def build_pipeline(config: RuntimeConfig, df: pd.DataFrame, dataset_name: str):
    agents = get_agents(config)

    async def run_sql_batch(
        questions: List[str],
        schema: list[dict[str, Any]],
        semantic_json: dict[str, Any],
        sample: list[dict[str, Any]],
        feedback_map: Optional[dict[str, str]],
    ) -> list[QueryResult]:
        payload: dict[str, Any] = {
            "questions": questions,
            "semantic_model": semantic_json,
            "schema": schema,
            "dataframe_sample": sample,
        }
        if feedback_map:
            payload["retry_feedback"] = feedback_map
        result = await _call(agents["sql"], _json_dumps(payload), "sql", config)
        answers: list[QueryResult] = []
        for answer in result.output.answers:
            if not answer.error:
                execution_result, error = _execute(answer.query, df)
                if error:
                    answer.error = error
                else:
                    actual = _format_result(execution_result, config.trim_chars)
                    answer.actual_result = actual
                    answer.result_summary = f"Result:\n{actual}"
            answers.append(answer)
        return answers

    async def semantic_node(state: MasterState) -> dict[str, Any]:
        print("  [semantic] Building semantic model...")
        cache_key = hashlib.md5(
            f"{df.shape}|{list(df.columns)}|{df.head(3).to_csv(index=False)}".encode("utf-8")
        ).hexdigest()
        if cache_key in _SEMANTIC_CACHE:
            validated = _SEMANTIC_CACHE[cache_key]
        else:
            payload = _json_dumps({"dataset_name": dataset_name, "profile": profile_dataframe(df)})
            result = await _call(agents["semantic"], payload, "semantic", config)
            validated = validate_semantics(result.output, df)
            _SEMANTIC_CACHE[cache_key] = validated

        floor = question_floor(validated)
        print(f"  [semantic] Done. Domain: {validated.inferred_domain or 'unknown'} | Q floor: {floor}")
        return {
            "semantic_model": validated,
            "question_floor": floor,
            "sql_retry_count": 0,
            "insights_retry_count": 0,
            "question_retry_count": 0,
            "refinement_feedback": None,
            "refinement_failed_questions": None,
            "questions": None,
            "answers": None,
            "insights": None,
            "refinement": None,
            "pipeline_log": [f"semantic -> done (floor={floor})"],
        }

    async def question_node(state: MasterState) -> dict[str, Any]:
        semantic = state["semantic_model"]
        sample = df.head(5).to_dict(orient="records")
        floor = state.get("question_floor") or 10
        feedback = state.get("refinement_feedback")
        retry_count = state.get("question_retry_count") or 0
        print(f"  [questions] Generating questions - floor {floor}...")

        for attempt in range(2):
            payload: dict[str, Any] = {
                "semantic_model": semantic.model_dump(),
                "dataframe_sample": sample,
                "question_floor": floor,
            }
            if feedback:
                payload["refinement_feedback"] = feedback
            if attempt == 1:
                payload["refinement_feedback"] = (
                    (payload.get("refinement_feedback") or "")
                    + f"\nThe previous pass produced too few useful questions. Return at least {floor} non-redundant questions."
                ).strip()
            result = await _call(agents["question"], _json_dumps(payload), "question", config)
            output = result.output
            deduped, removed = dedup_questions(output.questions)
            output = output.model_copy(update={"questions": deduped})
            if removed:
                print(f"  [questions] Removed {removed} duplicate question(s).")
            if len(output.questions) >= floor or attempt == 1:
                print(f"  [questions] Done - {len(output.questions)} questions.")
                log = list(state.get("pipeline_log") or [])
                log.append(f"question -> done ({len(output.questions)} questions)")
                return {
                    "questions": output,
                    "refinement_feedback": None,
                    "question_retry_count": retry_count + attempt,
                    "pipeline_log": log,
                }

        raise RuntimeError("Question generation did not complete.")

    async def sql_node(state: MasterState) -> dict[str, Any]:
        semantic = state["semantic_model"]
        questions_output = state["questions"]
        failed_questions = state.get("refinement_failed_questions") or []
        existing_answers = list(state.get("answers") or [])
        feedback = state.get("refinement_feedback")

        schema = [
            {
                "name": column.name,
                "dtype": column.dtype,
                "role": column.role,
                "description": column.description,
            }
            for column in semantic.columns
        ]
        sample = df.head(5).to_dict(orient="records")
        semantic_json = semantic.model_dump()
        if failed_questions:
            questions_to_run = failed_questions
            print(f"  [sql] Re-running {len(questions_to_run)} failed question(s)...")
        else:
            questions_to_run = [question.question for question in questions_output.questions]
            print(f"  [sql] Answering {len(questions_to_run)} questions...")

        answers: list[QueryResult] = []
        for offset in range(0, len(questions_to_run), config.batch_size):
            batch = questions_to_run[offset : offset + config.batch_size]
            feedback_map = {question: feedback for question in batch} if feedback else None
            print(f"  [sql] Batch {offset // config.batch_size + 1} ({len(batch)} questions)")
            answers.extend(await run_sql_batch(batch, schema, semantic_json, sample, feedback_map))

        for retry in range(1, config.sql_heal_retries + 1):
            broken = [answer for answer in answers if answer.error]
            if not broken:
                break
            print(f"  [sql] Self-healing retry {retry}/{config.sql_heal_retries} for {len(broken)} query failures...")
            feedback_map = {
                answer.question: (
                    f"Previous query:\n{answer.query}\n\n"
                    f"Error:\n{answer.error}\n\n"
                    "Return a corrected Python snippet that assigns the final answer to `result`."
                )
                for answer in broken
            }
            rerun = []
            retry_questions = [answer.question for answer in broken]
            for offset in range(0, len(retry_questions), config.batch_size):
                batch = retry_questions[offset : offset + config.batch_size]
                rerun.extend(await run_sql_batch(batch, schema, semantic_json, sample, feedback_map))
            rerun_map = {answer.question: answer for answer in rerun}
            answers = [rerun_map.get(answer.question, answer) if answer.error else answer for answer in answers]

        if failed_questions and existing_answers:
            replaced = set(failed_questions)
            answers = [answer for answer in existing_answers if answer.question not in replaced] + answers

        good = sum(1 for answer in answers if not answer.error)
        bad = sum(1 for answer in answers if answer.error)
        print(f"  [sql] Done - {good} successful, {bad} failed.")
        log = list(state.get("pipeline_log") or [])
        log.append(f"sql -> done ({good} ok, {bad} failed)")
        return {
            "answers": answers,
            "refinement_feedback": None,
            "refinement_failed_questions": None,
            "pipeline_log": log,
        }

    async def insights_node(state: MasterState) -> dict[str, Any]:
        questions_output = state["questions"]
        semantic = state["semantic_model"]
        answers = state["answers"]
        feedback = state.get("refinement_feedback")
        print("  [insights] Building business report...")
        qa_pairs = [
            {
                "question": answer.question,
                "actual_result": answer.actual_result if not answer.error else None,
                "explanation": answer.explanation,
                "error": answer.error,
            }
            for answer in answers
        ]
        payload: dict[str, Any] = {
            "semantic_model": semantic.model_dump(),
            "dataset_understanding": questions_output.dataset_understanding,
            "qa_pairs": qa_pairs,
            "pipeline_context_log": list(state.get("pipeline_log") or []),
        }
        if feedback:
            payload["refinement_feedback"] = feedback
        result = await _call(agents["insights"], _json_dumps(payload), "insights", config)
        insights = result.output
        deduped_actions, removed = dedup_actions(insights.action_items)
        if removed:
            print(f"  [insights] Removed {removed} duplicate action item(s).")
            insights = insights.model_copy(update={"action_items": deduped_actions})
        log = list(state.get("pipeline_log") or [])
        log.append(f"insights -> done ({len(insights.action_items)} actions)")
        print("  [insights] Done.")
        return {"insights": insights, "refinement_feedback": None, "pipeline_log": log}

    async def refinement_node(state: MasterState) -> dict[str, Any]:
        semantic = state["semantic_model"]
        answers = state["answers"]
        insights = state["insights"]
        print("  [refinement] Reviewing outputs...")
        payload = {
            "semantic_model": semantic.model_dump(),
            "qa_pairs": [
                {
                    "question": answer.question,
                    "actual_result": answer.actual_result,
                    "error": answer.error,
                    "explanation": answer.explanation,
                }
                for answer in answers
            ],
            "insights": insights.model_dump(),
        }
        result = await _call(agents["refinement"], _json_dumps(payload), "refinement", config)
        decision = result.output
        status = "approved" if decision.approved else "needs changes"
        print(f"  [refinement] {status}: {decision.reasoning}")
        log = list(state.get("pipeline_log") or [])
        log.append(f"refinement -> {status}")
        return {
            "refinement": decision,
            "refinement_feedback": decision.feedback if not decision.approved else None,
            "refinement_failed_questions": decision.failed_questions if not decision.approved else None,
            "pipeline_log": log,
        }

    async def manager_node(state: MasterState) -> dict[str, Any]:
        questions_output = state.get("questions")
        answers = state.get("answers")
        insights = state.get("insights")
        refinement = state.get("refinement")
        log = list(state.get("pipeline_log") or [])

        if questions_output is None:
            next_agent = "question"
        elif answers is None:
            next_agent = "sql"
        elif insights is None:
            next_agent = "insights"
        elif refinement is None:
            next_agent = "refinement"
        elif refinement.approved:
            next_agent = "done"
        elif refinement.failed_questions and (state.get("sql_retry_count") or 0) < config.max_retries:
            next_agent = "sql"
        elif (
            len(questions_output.questions) < (state.get("question_floor") or 0)
            and (state.get("question_retry_count") or 0) < config.max_retries
        ):
            next_agent = "question"
        elif (state.get("insights_retry_count") or 0) < config.max_retries:
            next_agent = "insights"
        else:
            next_agent = "done"

        updates: dict[str, Any] = {"_next": next_agent}
        if refinement and not refinement.approved and next_agent == "sql":
            updates["answers"] = None
            updates["insights"] = None
            updates["refinement"] = None
            updates["sql_retry_count"] = (state.get("sql_retry_count") or 0) + 1
        elif refinement and not refinement.approved and next_agent == "question":
            updates["questions"] = None
            updates["answers"] = None
            updates["insights"] = None
            updates["refinement"] = None
            updates["question_retry_count"] = (state.get("question_retry_count") or 0) + 1
        elif refinement and not refinement.approved and next_agent == "insights":
            updates["insights"] = None
            updates["refinement"] = None
            updates["insights_retry_count"] = (state.get("insights_retry_count") or 0) + 1

        log.append(f"manager -> {next_agent}")
        print(f"  [manager] -> {next_agent}")
        updates["pipeline_log"] = log
        return updates

    def route_from_manager(state: MasterState) -> Literal["question", "sql", "insights", "refinement", "done"]:
        return state.get("_next", "done")

    semantic_builder = StateGraph(MasterState)
    semantic_builder.add_node("semantic", semantic_node)
    semantic_builder.set_entry_point("semantic")
    semantic_builder.set_finish_point("semantic")
    semantic_graph = semantic_builder.compile()

    analysis_builder = StateGraph(MasterState)
    analysis_builder.add_node("manager", manager_node)
    analysis_builder.add_node("question", question_node)
    analysis_builder.add_node("sql", sql_node)
    analysis_builder.add_node("insights", insights_node)
    analysis_builder.add_node("refinement", refinement_node)
    analysis_builder.set_entry_point("manager")
    analysis_builder.add_conditional_edges(
        "manager",
        route_from_manager,
        {
            "question": "question",
            "sql": "sql",
            "insights": "insights",
            "refinement": "refinement",
            "done": "__end__",
        },
    )
    analysis_builder.add_edge("question", "manager")
    analysis_builder.add_edge("sql", "manager")
    analysis_builder.add_edge("insights", "manager")
    analysis_builder.add_edge("refinement", "manager")
    analysis_graph = analysis_builder.compile()

    master_builder = StateGraph(MasterState)
    master_builder.add_node("semantic_graph", semantic_graph)
    master_builder.add_node("analysis_graph", analysis_graph)
    master_builder.add_edge("semantic_graph", "analysis_graph")
    master_builder.set_entry_point("semantic_graph")
    master_builder.set_finish_point("analysis_graph")
    return master_builder.compile()


async def _run_async(df: pd.DataFrame, dataset_name: str, config: RuntimeConfig) -> dict[str, Any]:
    graph = build_pipeline(config, df, dataset_name)
    return await graph.ainvoke({})


def _execute_pipeline(df: pd.DataFrame, dataset_name: str, config: RuntimeConfig) -> tuple[dict[str, Any], str]:
    buffer = io.StringIO()
    original_stdout = sys.stdout
    sys.stdout = buffer
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(_run_async(df, dataset_name, config))
        finally:
            loop.close()
            asyncio.set_event_loop(None)
        return result, buffer.getvalue()
    finally:
        sys.stdout = original_stdout


def analyze_dataset(
    df: pd.DataFrame,
    *,
    dataset_name: Optional[str] = None,
    source_name: Optional[str] = None,
) -> dict[str, Any]:
    start = time.perf_counter()
    dataset_name = _safe_dataset_name(dataset_name, source_name)

    try:
        _validate_dataframe(df)
        config = get_runtime_config()
        raw_result, log_text = _execute_pipeline(df, dataset_name, config)
        duration_ms = int((time.perf_counter() - start) * 1000)
        return _build_success_envelope(
            raw_result,
            df=df,
            dataset_name=dataset_name,
            source_name=source_name,
            duration_ms=duration_ms,
            log_text=log_text,
            config=config,
        )
    except ValidationError as exc:
        duration_ms = int((time.perf_counter() - start) * 1000)
        return _build_error_envelope(
            code="VALIDATION_ERROR",
            message=str(exc),
            source_name=source_name,
            duration_ms=duration_ms,
        )
    except ConfigError as exc:
        duration_ms = int((time.perf_counter() - start) * 1000)
        return _build_error_envelope(
            code="CONFIG_ERROR",
            message=str(exc),
            source_name=source_name,
            duration_ms=duration_ms,
        )
    except Exception as exc:
        duration_ms = int((time.perf_counter() - start) * 1000)
        return _build_error_envelope(
            code="PIPELINE_ERROR",
            message="The analysis pipeline failed before it could finish.",
            source_name=source_name,
            duration_ms=duration_ms,
            details=str(exc),
        )


def run_analysis(
    df: pd.DataFrame,
    dataset_name: Optional[str] = None,
    source_name: Optional[str] = None,
) -> dict[str, Any]:
    """Backward-compatible public entry point used by the UI shell."""
    return analyze_dataset(df, dataset_name=dataset_name, source_name=source_name)
