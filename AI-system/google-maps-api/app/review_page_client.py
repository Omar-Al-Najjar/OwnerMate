import asyncio
import base64
import json
import logging
import re
import secrets
import urllib.parse
from typing import Any

from app.models import Review, ReviewCandidate

LOGGER = logging.getLogger(__name__)

GOOGLE_MAPS_HOME = "https://www.google.com/maps?hl={lang}"
GOOGLE_MAPS_PLACE = "https://www.google.com/maps/search/?api=1&query_place_id={place_id}&hl={lang}"
GOOGLE_MAPS_REVIEWS_RPC = (
    "https://www.google.com/maps/rpc/listugcposts?authuser=0&hl={lang}&pb={pb}"
)
RPC_PAGE_SIZE = 20
RPC_MAX_PAGES = 10
RPC_FETCH_TIMEOUT_MS = 30_000
RPC_BOOTSTRAP_WAIT_MS = 4_000


class ReviewPageScrapeError(Exception):
    pass


async def fetch_candidate_reviews(candidate: ReviewCandidate, *, lang: str) -> list[Review]:
    place_id = _resolve_reviews_place_id(candidate)
    if not place_id:
        raise ReviewPageScrapeError(
            "Google place is missing a review identifier, so reviews could not be loaded."
        )

    raw_pages = await _fetch_rpc_pages(place_id=place_id, lang=lang or "en")
    reviews = _parse_reviews_from_pages(raw_pages)
    if reviews:
        return reviews

    if (candidate.review_count or 0) > 0:
        raise ReviewPageScrapeError(
            f"Google Maps returned no readable reviews for {candidate.title}."
        )

    return []


async def _fetch_rpc_pages(*, place_id: str, lang: str) -> list[str]:
    request_id = _generate_request_id(21)
    start_url = _build_bootstrap_url(place_id=place_id, lang=lang)

    try:
        from playwright.async_api import TimeoutError as PlaywrightTimeoutError
        from playwright.async_api import async_playwright
    except ImportError as exc:  # pragma: no cover - only triggered outside runtime image
        raise ReviewPageScrapeError(
            "Playwright is not installed in the current google-maps-api runtime."
        ) from exc

    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                    "--no-sandbox",
                ],
            )
            context = await browser.new_context(
                locale=lang,
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
                ),
            )
            page = await context.new_page()

            try:
                try:
                    await page.goto(
                        GOOGLE_MAPS_HOME.format(lang=lang),
                        wait_until="domcontentloaded",
                        timeout=RPC_FETCH_TIMEOUT_MS,
                    )
                except PlaywrightTimeoutError:
                    LOGGER.warning("Timed out opening Google Maps home before review RPC fetch.")

                try:
                    await page.goto(
                        start_url,
                        wait_until="domcontentloaded",
                        timeout=RPC_FETCH_TIMEOUT_MS,
                    )
                except PlaywrightTimeoutError:
                    LOGGER.warning("Timed out opening Google Maps place page for place_id=%s.", place_id)

                await page.wait_for_timeout(RPC_BOOTSTRAP_WAIT_MS)
                return await _fetch_all_pages_via_browser(
                    page=page,
                    place_id=place_id,
                    lang=lang,
                    request_id=request_id,
                )
            finally:
                await context.close()
                await browser.close()
    except ReviewPageScrapeError:
        raise
    except Exception as exc:  # pragma: no cover - network/browser variability
        raise ReviewPageScrapeError(
            f"Google Maps review fetch failed for place_id {place_id}: {exc}"
        ) from exc


async def _fetch_all_pages_via_browser(
    *,
    page: Any,
    place_id: str,
    lang: str,
    request_id: str,
) -> list[str]:
    pages: list[str] = []
    next_page_token = ""

    for _ in range(RPC_MAX_PAGES):
        rpc_url = _build_reviews_rpc_url(
            place_id=place_id,
            page_token=next_page_token,
            page_size=RPC_PAGE_SIZE,
            request_id=request_id,
            lang=lang,
        )
        body = await _browser_fetch_text(page=page, url=rpc_url)
        if not body:
            break

        pages.append(body)
        next_page_token = _extract_next_page_token(body)
        if not next_page_token:
            break

        await asyncio.sleep(0.2)

    if not pages:
        raise ReviewPageScrapeError("Google Maps reviews endpoint returned no data.")

    return pages


async def _browser_fetch_text(*, page: Any, url: str) -> str:
    result = await page.evaluate(
        """async (rpcUrl) => {
            try {
                const response = await fetch(rpcUrl, {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "*/*",
                        "Accept-Language": navigator.language || "en-US,en;q=0.9"
                    }
                });
                return {
                    ok: response.ok,
                    status: response.status,
                    text: await response.text()
                };
            } catch (error) {
                return {
                    ok: false,
                    status: 0,
                    error: String(error)
                };
            }
        }""",
        url,
    )

    if not isinstance(result, dict):
        raise ReviewPageScrapeError("Google Maps browser fetch returned an unexpected payload.")

    if not result.get("ok"):
        detail = result.get("error") or f"HTTP {result.get('status')}"
        raise ReviewPageScrapeError(f"Google Maps RPC request failed: {detail}")

    text = result.get("text")
    if not isinstance(text, str) or not text.strip():
        raise ReviewPageScrapeError("Google Maps RPC request returned an empty response body.")

    return text


def _build_bootstrap_url(*, place_id: str, lang: str) -> str:
    return GOOGLE_MAPS_PLACE.format(
        place_id=urllib.parse.quote(place_id, safe=""),
        lang=lang,
    )


def _build_reviews_rpc_url(
    *,
    place_id: str,
    page_token: str,
    page_size: int,
    request_id: str,
    lang: str,
) -> str:
    encoded_place_id = urllib.parse.quote(place_id, safe="")
    encoded_page_token = urllib.parse.quote(page_token, safe="")
    pb = "".join(
        [
            f"!1m6!1s{encoded_place_id}",
            "!6m4!4m1!1e1!4m1!1e3",
            f"!2m2!1i{page_size}!2s{encoded_page_token}",
            f"!5m2!1s{request_id}!7e81",
            "!8m9!2b1!3b1!5b1!7b1",
            "!12m4!1b1!2b1!4m1!1e1!11m0!13m1!1e1",
        ]
    )
    return GOOGLE_MAPS_REVIEWS_RPC.format(lang=lang, pb=pb)


def _extract_next_page_token(payload: str | bytes) -> str:
    data = _load_json_payload(payload)
    if not isinstance(data, list) or len(data) < 2:
        return ""

    token = data[1]
    return token if isinstance(token, str) else ""


def _parse_reviews_from_pages(raw_pages: list[str | bytes]) -> list[Review]:
    reviews: list[Review] = []
    seen: set[str] = set()

    for raw_page in raw_pages:
        for review in _extract_reviews(raw_page):
            identity = _review_identity(review)
            if identity in seen:
                continue
            seen.add(identity)
            reviews.append(review)

    return reviews


def _extract_reviews(payload: str | bytes) -> list[Review]:
    data = _load_json_payload(payload)
    if not isinstance(data, list) or len(data) < 3:
        return []

    reviews_array = _get_nested(data, 2)
    if not isinstance(reviews_array, list):
        reviews_array = _get_nested(data, 0)
    if not isinstance(reviews_array, list):
        return []

    return _parse_reviews(reviews_array)


def _load_json_payload(payload: str | bytes) -> Any:
    if isinstance(payload, bytes):
        text = payload.decode("utf-8", errors="ignore")
    else:
        text = payload

    if text.startswith(")]}'\n"):
        text = text[5:]
    elif text.startswith(")]}'"):
        text = text[4:]

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        LOGGER.debug("Failed to decode Google Maps reviews payload.", exc_info=True)
        return None


def _parse_reviews(items: list[Any]) -> list[Review]:
    parsed: list[Review] = []

    for item in items:
        wrapper = _ensure_list(item)
        review_data = _ensure_list(_get_nested(wrapper, 0)) or wrapper
        if not review_data:
            continue

        time_parts = _ensure_list(_get_nested(review_data, 2, 2, 0, 1, 21, 6, 8))
        if not time_parts:
            time_parts = _ensure_list(_get_nested(review_data, 2, 2, 0, 1, 6, 8))

        profile_picture = _decode_google_url(_get_nested_str(review_data, 1, 4, 5, 1))
        if not profile_picture:
            profile_picture = (
                _get_nested_str(review_data, 1, 2, 0)
                or _get_nested_str(review_data, 0, 2, 0)
            )

        author = (
            _get_nested_str(review_data, 1, 4, 5, 0)
            or _get_nested_str(review_data, 1, 4, 4)
            or _get_nested_str(review_data, 0, 1)
        )

        rating = (
            _get_nested_number(review_data, 2, 0, 0)
            or _get_nested_number(review_data, 2, 0)
            or _get_nested_number(review_data, 1, 0, 0)
        )

        text = (
            _get_nested_str(review_data, 2, 15, 0, 0)
            or _get_nested_str(review_data, 2, 15, 0)
            or _get_nested_str(review_data, 3, 0)
        )

        image_items = _ensure_list(_get_nested(review_data, 2, 2, 0, 1, 21, 7))
        if not image_items:
            image_items = _ensure_list(_get_nested(review_data, 2, 2, 0, 1, 7))

        date = None
        if len(time_parts) >= 3:
            date = f"{time_parts[0]}-{time_parts[1]}-{time_parts[2]}"

        images: list[str] = []
        for image in image_items:
            if isinstance(image, str) and len(image) > 2:
                images.append(image[2:])

        if not author and not text and not rating:
            continue

        normalized_text = text.strip() if isinstance(text, str) and text.strip() else None
        review = Review(
            author=_normalize_text(author),
            rating=float(rating) if rating is not None else None,
            text=_normalize_text(normalized_text),
            date=date,
        )

        if images:
            LOGGER.debug(
                "Google Maps review by %s includes %d images.",
                review.author or "unknown author",
                len(images),
            )
        if profile_picture:
            LOGGER.debug(
                "Google Maps review by %s includes a profile picture URL.",
                review.author or "unknown author",
            )

        parsed.append(review)

    return parsed


def _get_nested(value: Any, *indexes: int) -> Any:
    current = value
    for index in indexes:
        if not isinstance(current, list) or index >= len(current):
            return None
        current = current[index]
    return current


def _get_nested_str(value: Any, *indexes: int) -> str | None:
    nested = _get_nested(value, *indexes)
    return nested if isinstance(nested, str) and nested else None


def _get_nested_number(value: Any, *indexes: int) -> float | None:
    nested = _get_nested(value, *indexes)
    if isinstance(nested, (int, float)):
        return float(nested)
    return None


def _ensure_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _decode_google_url(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return _normalize_text(bytes(value, "utf-8").decode("unicode_escape"))
    except UnicodeDecodeError:
        return _normalize_text(value)


def _review_identity(review: Review) -> str:
    return "|".join(
        [
            (review.author or "").strip().lower(),
            str(review.rating or ""),
            (review.text or "").strip(),
            (review.date or "").strip().lower(),
        ]
    )


def _generate_request_id(length: int) -> str:
    raw = secrets.token_bytes(max(16, (length * 6 + 7) // 8))
    encoded = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    return encoded[:length]


def _normalize_text(value: str | None) -> str | None:
    if not value:
        return None

    text = value.strip()
    if not text:
        return None

    for encoding in ("latin-1", "cp1252"):
        try:
            repaired = text.encode(encoding).decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
        if repaired:
            text = repaired
            break

    return text


def _resolve_reviews_place_id(candidate: ReviewCandidate) -> str:
    for value in (_extract_place_id_from_link(candidate.link), candidate.place_id):
        normalized = (value or "").strip()
        if normalized:
            return normalized
    return ""


def _extract_place_id_from_link(link: str | None) -> str | None:
    if not link:
        return None

    patterns = (
        r"!1s([^!]+)",
        r"place_id=([^&]+)",
        r"(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)",
        r"!19s([^!]+)",
    )

    for pattern in patterns:
        match = re.search(pattern, link)
        if not match:
            continue
        try:
            return urllib.parse.unquote(match.group(1))
        except IndexError:
            continue

    return None
