import json
import os
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path

from app.models import StoredReviewJob


JOB_STORAGE_DIR = Path(
    os.getenv(
        "GOOGLE_REVIEW_JOB_STORAGE_DIR",
        Path(__file__).resolve().parent.parent / ".review-jobs",
    )
)
JOB_TIMEOUT_SECONDS = int(
    os.getenv("GOOGLE_REVIEW_JOB_TIMEOUT_SECONDS", "720")
)


class ReviewJobStore:
    def __init__(self, base_dir: Path | None = None) -> None:
        self.base_dir = Path(base_dir or JOB_STORAGE_DIR)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def get(self, job_id: str) -> StoredReviewJob | None:
        path = self._get_path(job_id)
        if not path.exists():
            return None
        return StoredReviewJob.model_validate_json(path.read_text(encoding="utf-8"))

    def save(self, job: StoredReviewJob) -> StoredReviewJob:
        path = self._get_path(job.job_id)
        payload = job.model_dump_json(indent=2)
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            delete=False,
            dir=str(self.base_dir),
            suffix=".tmp",
        ) as handle:
            handle.write(payload)
            temp_path = Path(handle.name)
        temp_path.replace(path)
        return job

    def mark_timed_out_if_stale(self, job: StoredReviewJob) -> StoredReviewJob:
        if job.status not in {"queued", "running"}:
            return job
        if job.started_at is None:
            return job

        cutoff = datetime.now(UTC) - timedelta(seconds=JOB_TIMEOUT_SECONDS)
        if job.started_at >= cutoff:
            return job

        job.status = "failed"
        job.provider_status = "timed_out"
        job.message = (
            f"Google review lookup timed out for {job.business_name}. "
            "Try a more specific business name, branch, or city."
        )
        job.finished_at = datetime.now(UTC)
        return self.save(job)

    def _get_path(self, job_id: str) -> Path:
        return self.base_dir / f"{job_id}.json"
