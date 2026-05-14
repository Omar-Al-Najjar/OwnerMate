import asyncio
import csv
import io
import json
import os
from hashlib import sha256
from typing import Any

import httpx

from app.models import PlaceResult, Review, ReviewCandidate

SCRAPER_BASE_URL = os.getenv("SCRAPER_BASE_URL", "http://localhost:8080")

STATUS_OK = "ok"
STATUS_FAILED = "failed"
SCRAPER_MAX_TIME = 600
POLL_INITIAL_DELAY = 10.0
POLL_MAX_DELAY = 30.0
POLL_BACKOFF_FACTOR = 1.5
POLL_TIMEOUT = SCRAPER_MAX_TIME + 120.0

PLACE_TITLE_ALIASES = ("title", "name", "place_name", "business_name")
PLACE_CATEGORY_ALIASES = ("category", "categories", "main_category", "type", "business_type")
PLACE_ADDRESS_ALIASES = (
    "address",
    "full_address",
    "street_address",
    "complete_address",
    "formatted_address",
)
PLACE_REVIEW_COUNT_ALIASES = (
    "review_count",
    "reviews",
    "reviews_count",
    "reviews_total",
    "user_ratings_total",
)
PLACE_RATING_ALIASES = (
    "review_rating",
    "rating",
    "stars",
    "stars_average",
    "average_rating",
    "reviews_average",
)
PLACE_ID_ALIASES = ("place_id", "data_id", "dataid", "cid", "google_place_id")
PLACE_LINK_ALIASES = ("link", "url", "google_maps_url", "maps_url")
USER_REVIEW_ALIASES = (
    "user_reviews",
    "user_reviews_extended",
    "reviews_json",
    "review_details",
)

REVIEW_AUTHOR_ALIASES = ("Name", "author_name", "author", "name")
REVIEW_RATING_ALIASES = ("Rating", "rating", "stars")
REVIEW_TEXT_ALIASES = ("Description", "text", "review_text", "comment")
REVIEW_DATE_ALIASES = ("relative_date", "date", "published_at", "time")


class ScraperError(Exception):
    pass


async def get_reviews(business_name: str, depth: int, lang: str) -> list[dict]:
    place_results = await find_places(
        business_name=business_name,
        depth=depth,
        lang=lang,
    )
    if not place_results:
        return []
    return [review.model_dump(mode="json") for review in place_results[0].reviews]


async def find_places(
    *,
    business_name: str,
    depth: int,
    lang: str,
) -> list[PlaceResult]:
    async with httpx.AsyncClient(base_url=SCRAPER_BASE_URL, timeout=30.0) as client:
        job_id = await _create_job(client, business_name, depth, lang)
        await _wait_for_job(client, job_id)
        csv_text = await _download_csv(client, job_id)
    return _parse_places(csv_text)


async def _create_job(
    client: httpx.AsyncClient,
    business_name: str,
    depth: int,
    lang: str,
) -> str:
    payload = {
        "Name": business_name,
        "keywords": [business_name],
        "lang": lang,
        "zoom": 15,
        "depth": depth,
        "radius": 10000,
        "max_time": SCRAPER_MAX_TIME,
        "fast_mode": False,
        "email": False,
        "lat": "",
        "lon": "",
    }

    response = await client.post("/api/v1/jobs", json=payload)
    if response.status_code not in (200, 201):
        raise ScraperError(
            f"Failed to create scraper job: {response.status_code} {response.text}"
        )

    body = response.json()
    job_id = body.get("id") or body.get("ID")
    if not job_id:
        raise ScraperError(f"No job ID in scraper response: {body}")

    return str(job_id)


async def _wait_for_job(client: httpx.AsyncClient, job_id: str) -> None:
    delay = POLL_INITIAL_DELAY
    elapsed = 0.0

    while elapsed < POLL_TIMEOUT:
        await asyncio.sleep(delay)
        elapsed += delay

        response = await client.get(f"/api/v1/jobs/{job_id}")
        if response.status_code == 404:
            raise ScraperError(f"Job {job_id} not found")
        response.raise_for_status()

        body = response.json()
        status = str(body.get("Status") or body.get("status") or "").lower()
        if status == STATUS_OK:
            return
        if status == STATUS_FAILED:
            raise ScraperError(f"Scraper job {job_id} failed")

        delay = min(delay * POLL_BACKOFF_FACTOR, POLL_MAX_DELAY)

    raise ScraperError(f"Timed out waiting for job {job_id} after {POLL_TIMEOUT}s")


async def _download_csv(client: httpx.AsyncClient, job_id: str) -> str:
    response = await client.get(f"/api/v1/jobs/{job_id}/download", timeout=60.0)
    if response.status_code == 404:
        raise ScraperError(f"CSV not found for job {job_id}")
    response.raise_for_status()
    return response.text


def _parse_places(csv_text: str) -> list[PlaceResult]:
    reader = csv.DictReader(io.StringIO(csv_text))
    place_map: dict[str, PlaceResult] = {}

    for row in reader:
        normalized_row = _normalize_row(row)
        candidate = _build_candidate(normalized_row)
        reviews = _parse_row_reviews(normalized_row)

        if candidate is None and not reviews:
            continue

        if candidate is None:
            candidate = ReviewCandidate(
                candidate_id=_build_hash_identifier("unknown-place"),
                title="Google place",
            )

        existing = place_map.get(candidate.candidate_id)
        if existing is None:
            place_map[candidate.candidate_id] = PlaceResult(candidate=candidate, reviews=reviews)
            continue

        if not existing.candidate.category and candidate.category:
            existing.candidate.category = candidate.category
        if not existing.candidate.address and candidate.address:
            existing.candidate.address = candidate.address
        if existing.candidate.review_count is None and candidate.review_count is not None:
            existing.candidate.review_count = candidate.review_count
        if existing.candidate.review_rating is None and candidate.review_rating is not None:
            existing.candidate.review_rating = candidate.review_rating
        if not existing.candidate.place_id and candidate.place_id:
            existing.candidate.place_id = candidate.place_id
        if not existing.candidate.link and candidate.link:
            existing.candidate.link = candidate.link

        existing_ids = {
            _build_review_identity(review)
            for review in existing.reviews
        }
        for review in reviews:
            identity = _build_review_identity(review)
            if identity in existing_ids:
                continue
            existing.reviews.append(review)
            existing_ids.add(identity)

    return list(place_map.values())


def _normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in row.items():
        if key is None:
            continue
        normalized[key.strip().lower()] = value
    return normalized


def _build_candidate(row: dict[str, Any]) -> ReviewCandidate | None:
    title = _normalize_optional_string(_get_first_value(row, PLACE_TITLE_ALIASES))
    category = _normalize_optional_string(_get_first_value(row, PLACE_CATEGORY_ALIASES))
    address = _normalize_optional_string(_get_first_value(row, PLACE_ADDRESS_ALIASES))
    review_count = _normalize_int(_get_first_value(row, PLACE_REVIEW_COUNT_ALIASES))
    review_rating = _normalize_float(_get_first_value(row, PLACE_RATING_ALIASES))
    place_id = _normalize_optional_string(_get_first_value(row, PLACE_ID_ALIASES))
    link = _normalize_optional_string(_get_first_value(row, PLACE_LINK_ALIASES))

    if title is None and address is None and place_id is None and link is None:
        return None

    candidate_seed = place_id or link or "|".join(
        part for part in (title, address) if part
    )
    return ReviewCandidate(
        candidate_id=_build_hash_identifier(candidate_seed or "google-place"),
        title=title or address or "Google place",
        category=category,
        address=address,
        review_count=review_count,
        review_rating=review_rating,
        place_id=place_id,
        link=link,
    )


def _parse_row_reviews(row: dict[str, Any]) -> list[Review]:
    raw = _get_first_value(row, USER_REVIEW_ALIASES)
    if isinstance(raw, str) and raw.strip():
        parsed = _load_json(raw)
        if isinstance(parsed, list):
            return _normalize_review_items(parsed)

    direct_review = _build_direct_review(row)
    return [direct_review] if direct_review is not None else []


def _normalize_review_items(items: list[Any]) -> list[Review]:
    reviews: list[Review] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        author = _normalize_optional_string(_get_first_value(item, REVIEW_AUTHOR_ALIASES))
        rating = _normalize_float(_get_first_value(item, REVIEW_RATING_ALIASES))
        text = _normalize_optional_string(_get_first_value(item, REVIEW_TEXT_ALIASES))
        date = _normalize_optional_string(_get_first_value(item, REVIEW_DATE_ALIASES))
        if not text:
            continue
        reviews.append(
            Review(
                author=author,
                rating=rating,
                text=text,
                date=date,
            )
        )
    return reviews


def _build_direct_review(row: dict[str, Any]) -> Review | None:
    author = _normalize_optional_string(_get_first_value(row, REVIEW_AUTHOR_ALIASES))
    rating = _normalize_float(_get_first_value(row, REVIEW_RATING_ALIASES))
    text = _normalize_optional_string(_get_first_value(row, REVIEW_TEXT_ALIASES))
    date = _normalize_optional_string(_get_first_value(row, REVIEW_DATE_ALIASES))
    if not text:
        return None
    return Review(author=author, rating=rating, text=text, date=date)


def _get_first_value(source: dict[str, Any], aliases: tuple[str, ...]) -> Any:
    if not isinstance(source, dict):
        return None

    direct = {}
    for key, value in source.items():
        normalized_key = str(key).strip().lower()
        direct[normalized_key] = value

    for alias in aliases:
        value = direct.get(alias.strip().lower())
        if value not in (None, ""):
            return value
    return None


def _load_json(raw: str) -> Any:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def _build_hash_identifier(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()[:24]


def _build_review_identity(review: Review) -> str:
    seed = "|".join(
        [
            str(review.author or "").strip().lower(),
            str(review.rating or ""),
            str(review.text or "").strip(),
            str(review.date or "").strip().lower(),
        ]
    )
    return _build_hash_identifier(seed)


def _normalize_optional_string(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _normalize_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _normalize_int(value: Any) -> int | None:
    normalized = _normalize_float(value)
    if normalized is None:
        return None
    return int(round(normalized))
