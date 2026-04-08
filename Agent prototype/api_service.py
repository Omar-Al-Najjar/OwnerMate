from __future__ import annotations

import asyncio
import io
import os
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from uuid import uuid4

import pandas as pd
from fastapi import (
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from pydantic import BaseModel

from localization import localize_job_payload
from pipeline import get_runtime_summary, run_analysis

DEFAULT_SERVICE_SECRET = "ownermate-local-analysis-secret"
DEFAULT_MAX_FILE_MB = 10
DEFAULT_MAX_CONCURRENCY = 1
JOB_TTL = timedelta(hours=1)

JobStatus = Literal["queued", "running", "success", "error"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _get_service_secret() -> str:
    return os.getenv("DATASET_ANALYSIS_SERVICE_SECRET", DEFAULT_SERVICE_SECRET)


def _get_max_file_bytes() -> int:
    raw = os.getenv("DATASET_ANALYSIS_MAX_FILE_MB", str(DEFAULT_MAX_FILE_MB))
    try:
        return int(raw) * 1024 * 1024
    except ValueError:
        return DEFAULT_MAX_FILE_MB * 1024 * 1024


def _get_max_concurrency() -> int:
    raw = os.getenv("DATASET_ANALYSIS_MAX_CONCURRENCY", str(DEFAULT_MAX_CONCURRENCY))
    try:
        return max(1, int(raw))
    except ValueError:
        return DEFAULT_MAX_CONCURRENCY


def _build_empty_data(source_name: str | None = None) -> dict[str, Any]:
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
    source_name: str | None = None,
    details: str | None = None,
) -> dict[str, Any]:
    runtime = get_runtime_summary()
    return {
        "task_type": "analyze_dataset",
        "status": "error",
        "data": _build_empty_data(source_name),
        "meta": {
            "agent": "dataset_analysis_orchestrator",
            "duration_ms": 0,
            "model": runtime["model"],
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


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: Literal["dataset_analysis_service"]
    runtime: dict[str, Any]
    queue: dict[str, int]


class JobCreateResponse(BaseModel):
    job_id: str
    status: JobStatus
    created_at: str
    updated_at: str
    file_name: str
    dataset_name: str | None = None
    source_name: str | None = None


class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    created_at: str
    updated_at: str
    file_name: str
    dataset_name: str | None = None
    source_name: str | None = None
    owner_user_id: str | None = None
    business_id: str | None = None
    result: dict[str, Any] | None = None
    error: dict[str, Any] | None = None


@dataclass
class AnalysisJob:
    job_id: str
    owner_user_id: str | None
    business_id: str | None
    dataset_name: str | None
    source_name: str | None
    file_name: str
    file_bytes: bytes = field(repr=False)
    status: JobStatus = "queued"
    created_at: datetime = field(default_factory=_now)
    updated_at: datetime = field(default_factory=_now)
    result: dict[str, Any] | None = None
    error: dict[str, Any] | None = None
    localized_results: dict[str, dict[str, Any]] = field(default_factory=dict, repr=False)
    localized_errors: dict[str, dict[str, Any] | None] = field(
        default_factory=dict, repr=False
    )

    def to_public(self, locale: Literal["en", "ar"] = "en") -> JobStatusResponse:
        localized_result = self.localized_results.get(locale)
        localized_error = self.localized_errors.get(locale)
        return JobStatusResponse(
            job_id=self.job_id,
            status=self.status,
            created_at=self.created_at.isoformat(),
            updated_at=self.updated_at.isoformat(),
            file_name=self.file_name,
            dataset_name=self.dataset_name,
            source_name=self.source_name,
            owner_user_id=self.owner_user_id,
            business_id=self.business_id,
            result=localized_result if localized_result is not None else self.result,
            error=localized_error if locale in self.localized_errors else self.error,
        )


class AnalysisJobManager:
    def __init__(self, *, max_concurrency: int) -> None:
        self.max_concurrency = max_concurrency
        self._jobs: dict[str, AnalysisJob] = {}
        self._lock = asyncio.Lock()
        self._semaphore = asyncio.Semaphore(max_concurrency)

    async def create_job(
        self,
        *,
        file_name: str,
        file_bytes: bytes,
        dataset_name: str | None,
        source_name: str | None,
        owner_user_id: str | None,
        business_id: str | None,
    ) -> AnalysisJob:
        job = AnalysisJob(
            job_id=str(uuid4()),
            owner_user_id=owner_user_id,
            business_id=business_id,
            dataset_name=dataset_name,
            source_name=source_name,
            file_name=file_name,
            file_bytes=file_bytes,
        )
        async with self._lock:
            self._purge_expired_jobs_locked()
            self._jobs[job.job_id] = job
        asyncio.create_task(self._run_job(job.job_id))
        return job

    async def get_job(
        self, job_id: str, *, owner_user_id: str | None
    ) -> AnalysisJob | None:
        async with self._lock:
            self._purge_expired_jobs_locked()
            job = self._jobs.get(job_id)
            if job is None:
                return None
            if job.owner_user_id and job.owner_user_id != owner_user_id:
                return None
            return job

    async def queue_snapshot(self) -> dict[str, int]:
        async with self._lock:
            self._purge_expired_jobs_locked()
            total = len(self._jobs)
            queued = sum(1 for job in self._jobs.values() if job.status == "queued")
            running = sum(1 for job in self._jobs.values() if job.status == "running")
            return {
                "total_jobs": total,
                "queued_jobs": queued,
                "running_jobs": running,
            }

    async def _run_job(self, job_id: str) -> None:
        async with self._semaphore:
            async with self._lock:
                job = self._jobs.get(job_id)
                if job is None:
                    return
                job.status = "running"
                job.updated_at = _now()

            try:
                result = await asyncio.to_thread(self._execute_job_sync, job)
            except Exception as exc:
                error_envelope = _build_error_envelope(
                    code="PIPELINE_ERROR",
                    message="The analysis pipeline failed before it could finish.",
                    source_name=job.source_name or job.file_name,
                    details=str(exc),
                )
                await self._finalize_job(
                    job_id,
                    status="error",
                    result=error_envelope,
                    error=error_envelope.get("error"),
                )
                return

            normalized_status: JobStatus = (
                "error" if result.get("status") == "error" else "success"
            )
            await self._finalize_job(
                job_id,
                status=normalized_status,
                result=result,
                error=result.get("error") if normalized_status == "error" else None,
            )

    async def _finalize_job(
        self,
        job_id: str,
        *,
        status: JobStatus,
        result: dict[str, Any],
        error: dict[str, Any] | None,
    ) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job.status = status
            job.result = result
            job.error = error
            job.localized_results.clear()
            job.localized_errors.clear()
            job.file_bytes = b""
            job.updated_at = _now()

    async def get_or_create_localized_public(
        self,
        job_id: str,
        *,
        owner_user_id: str | None,
        locale: Literal["en", "ar"],
    ) -> JobStatusResponse | None:
        job = await self.get_job(job_id, owner_user_id=owner_user_id)
        if job is None:
            return None

        if locale == "en" or job.result is None or job.status not in {"success", "error"}:
            return job.to_public(locale)

        if locale in job.localized_results or locale in job.localized_errors:
            return job.to_public(locale)

        localized_result, localized_error = await localize_job_payload(
            job.result, job.error, locale
        )

        async with self._lock:
            current_job = self._jobs.get(job_id)
            if current_job is None:
                return None
            if current_job.owner_user_id and current_job.owner_user_id != owner_user_id:
                return None
            if localized_result is not None:
                current_job.localized_results[locale] = localized_result
            current_job.localized_errors[locale] = localized_error
            return current_job.to_public(locale)

    def _execute_job_sync(self, job: AnalysisJob) -> dict[str, Any]:
        try:
            dataframe = pd.read_csv(io.BytesIO(job.file_bytes))
        except Exception as exc:
            return _build_error_envelope(
                code="CSV_READ_ERROR",
                message="The CSV could not be read.",
                source_name=job.source_name or job.file_name,
                details=str(exc),
            )

        return run_analysis(
            dataframe,
            dataset_name=job.dataset_name,
            source_name=job.source_name or job.file_name,
        )

    def _purge_expired_jobs_locked(self) -> None:
        cutoff = _now() - JOB_TTL
        expired_ids = [
            job_id
            for job_id, job in self._jobs.items()
            if job.status in {"success", "error"} and job.updated_at < cutoff
        ]
        for job_id in expired_ids:
            self._jobs.pop(job_id, None)


job_manager = AnalysisJobManager(max_concurrency=_get_max_concurrency())
app = FastAPI(
    title="OwnerMate Dataset Analysis Service",
    version="0.1.0",
    description=(
        "Async API wrapper around the OwnerMate CSV analysis prototype. "
        "This service is intended to be called by the website server, not directly by browsers."
    ),
)


def _verify_service_secret(secret: str | None) -> None:
    expected = _get_service_secret()
    if not secret or not secrets.compare_digest(secret, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid analysis service secret.",
        )


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="dataset_analysis_service",
        runtime=get_runtime_summary(),
        queue=await job_manager.queue_snapshot(),
    )


@app.post("/jobs", response_model=JobCreateResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_job(
    file: UploadFile = File(...),
    dataset_name: str | None = Form(default=None),
    source_name: str | None = Form(default=None),
    owner_user_id: str | None = Form(default=None),
    business_id: str | None = Form(default=None),
    service_secret: str | None = Header(default=None, alias="X-OwnerMate-Service-Secret"),
) -> JobCreateResponse:
    _verify_service_secret(service_secret)

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only CSV uploads are supported.",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The uploaded CSV is empty.",
        )

    if len(file_bytes) > _get_max_file_bytes():
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="The uploaded CSV exceeds the size limit.",
        )

    job = await job_manager.create_job(
        file_name=file.filename,
        file_bytes=file_bytes,
        dataset_name=dataset_name.strip() if dataset_name else None,
        source_name=source_name.strip() if source_name else file.filename,
        owner_user_id=owner_user_id.strip() if owner_user_id else None,
        business_id=business_id.strip() if business_id else None,
    )
    return JobCreateResponse(
        job_id=job.job_id,
        status=job.status,
        created_at=job.created_at.isoformat(),
        updated_at=job.updated_at.isoformat(),
        file_name=job.file_name,
        dataset_name=job.dataset_name,
        source_name=job.source_name,
    )


@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job(
    job_id: str,
    locale: Literal["en", "ar"] = Query(default="en"),
    service_secret: str | None = Header(default=None, alias="X-OwnerMate-Service-Secret"),
    owner_user_id: str | None = Header(default=None, alias="X-OwnerMate-Owner-User-Id"),
) -> JobStatusResponse:
    _verify_service_secret(service_secret)
    job = await job_manager.get_or_create_localized_public(
        job_id, owner_user_id=owner_user_id, locale=locale
    )
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis job not found.",
        )
    return job
