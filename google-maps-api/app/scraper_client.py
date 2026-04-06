import asyncio
import csv
import io
import json
import os

import httpx

SCRAPER_BASE_URL = os.getenv("SCRAPER_BASE_URL", "http://localhost:8080")

# Scraper job statuses
STATUS_OK = "ok"
STATUS_FAILED = "failed"
TERMINAL_STATUSES = {STATUS_OK, STATUS_FAILED}

# How long the scraper is allowed to run (seconds). Sent in the job payload.
SCRAPER_MAX_TIME = 600

# Polling config — timeout must exceed SCRAPER_MAX_TIME to avoid giving up early
POLL_INITIAL_DELAY = 10.0
POLL_MAX_DELAY = 30.0
POLL_BACKOFF_FACTOR = 1.5
POLL_TIMEOUT = SCRAPER_MAX_TIME + 120.0  # scraper budget + 2 min grace period


class ScraperError(Exception):
    pass


async def get_reviews(business_name: str, depth: int, lang: str) -> list[dict]:
    """
    Full pipeline: create job → poll until done → download CSV → parse reviews.
    Returns a list of review dicts (author, rating, text, date).
    """
    async with httpx.AsyncClient(base_url=SCRAPER_BASE_URL, timeout=30.0) as client:
        job_id = await _create_job(client, business_name, depth, lang)
        await _wait_for_job(client, job_id)
        csv_text = await _download_csv(client, job_id)

    return _parse_reviews(csv_text)


async def _create_job(client: httpx.AsyncClient, business_name: str, depth: int, lang: str) -> str:
    payload = {
        "Name": business_name,
        "keywords": [business_name],
        "lang": lang,
        "zoom": 15,
        "depth": depth,
        "radius": 10000,
        # max_time is in seconds in the JSON API; minimum allowed is 180s
        "max_time": SCRAPER_MAX_TIME,
        "fast_mode": False,
        "email": False,
        "lat": "",
        "lon": "",
    }

    resp = await client.post("/api/v1/jobs", json=payload)

    if resp.status_code not in (200, 201):
        raise ScraperError(f"Failed to create scraper job: {resp.status_code} {resp.text}")

    data = resp.json()
    job_id = data.get("id") or data.get("ID")

    if not job_id:
        raise ScraperError(f"No job ID in scraper response: {data}")

    return job_id


async def _wait_for_job(client: httpx.AsyncClient, job_id: str) -> None:
    delay = POLL_INITIAL_DELAY
    elapsed = 0.0

    while elapsed < POLL_TIMEOUT:
        await asyncio.sleep(delay)
        elapsed += delay

        resp = await client.get(f"/api/v1/jobs/{job_id}")

        if resp.status_code == 404:
            raise ScraperError(f"Job {job_id} not found")

        resp.raise_for_status()
        data = resp.json()

        status = data.get("Status") or data.get("status", "")

        if status == STATUS_OK:
            return
        if status == STATUS_FAILED:
            raise ScraperError(f"Scraper job {job_id} failed")

        delay = min(delay * POLL_BACKOFF_FACTOR, POLL_MAX_DELAY)

    raise ScraperError(f"Timed out waiting for job {job_id} after {POLL_TIMEOUT}s")


async def _download_csv(client: httpx.AsyncClient, job_id: str) -> str:
    resp = await client.get(f"/api/v1/jobs/{job_id}/download", timeout=60.0)

    if resp.status_code == 404:
        raise ScraperError(f"CSV not found for job {job_id}")

    resp.raise_for_status()
    return resp.text


def _parse_reviews(csv_text: str) -> list[dict]:
    """
    Parse the CSV downloaded from the scraper and extract reviews.
    The 'user_reviews' column contains a JSON array of review objects.
    Each review has fields like: author_name, rating, relative_date, text (from DOMReview).
    """
    reviews: list[dict] = []

    reader = csv.DictReader(io.StringIO(csv_text))

    for row in reader:
        raw = row.get("user_reviews", "").strip()
        if not raw:
            continue

        try:
            review_list = json.loads(raw)
        except json.JSONDecodeError:
            continue

        if not isinstance(review_list, list):
            continue

        for rv in review_list:
            rating = rv.get("Rating")
            reviews.append({
                "author": rv.get("Name") or None,
                "rating": float(rating) if rating is not None else None,
                "text": rv.get("Description") or None,
            })

    return reviews
