from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def request_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    payload: dict | None = None,
) -> tuple[int, dict]:
    body = None
    request_headers = dict(headers or {})
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        request_headers["Content-Type"] = "application/json"

    request = urllib.request.Request(
        url=url,
        data=body,
        headers=request_headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode("utf-8"))


def wait_for_ready(base_url: str, timeout_seconds: int = 90) -> None:
    deadline = time.time() + timeout_seconds
    last_status = None
    while time.time() < deadline:
        try:
            status_code, body = request_json("GET", f"{base_url}/ready")
            last_status = (status_code, body)
            if status_code == 200 and body.get("success") is True:
                return
        except Exception:
            pass
        time.sleep(2)
    raise RuntimeError(f"Backend did not become ready in time. Last status: {last_status}")


def assert_success(status_code: int, body: dict, context: str) -> None:
    if status_code >= 400 or body.get("success") is not True:
        raise AssertionError(f"{context} failed: status={status_code}, body={body}")


def main() -> None:
    base_url = os.environ.get("SMOKE_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
    access_token = os.environ["SMOKE_ACCESS_TOKEN"]
    headers = {"Authorization": f"Bearer {access_token}"}

    wait_for_ready(base_url)

    status_code, body = request_json("GET", f"{base_url}/health")
    assert_success(status_code, body, "health")

    status_code, body = request_json("GET", f"{base_url}/auth/me", headers=headers)
    assert_success(status_code, body, "auth/me")
    businesses = body["data"].get("businesses") or []
    if not businesses:
        raise AssertionError(f"auth/me returned no businesses: {body}")
    business_id = businesses[0]["id"]

    status_code, body = request_json(
        "POST",
        f"{base_url}/reviews/import",
        headers=headers,
        payload={
            "business_id": business_id,
            "source": "google",
            "reviews": [
                {
                    "source_review_id": "smoke-review-1",
                    "reviewer_name": "Smoke Customer",
                    "rating": 5,
                    "language": "en",
                    "review_text": "Great service and friendly staff",
                    "status": "pending",
                    "source_metadata": {"scenario": "smoke"},
                }
            ],
        },
    )
    assert_success(status_code, body, "reviews/import")
    imported_reviews = body["data"]["imported_reviews"]
    if not imported_reviews:
        raise AssertionError(f"reviews/import returned no imported reviews: {body}")
    review_id = imported_reviews[0]["id"]

    list_query = urllib.parse.urlencode({"business_id": business_id, "limit": 10})
    status_code, body = request_json(
        "GET",
        f"{base_url}/reviews?{list_query}",
        headers=headers,
    )
    assert_success(status_code, body, "reviews list")

    detail_query = urllib.parse.urlencode({"business_id": business_id})
    status_code, body = request_json(
        "GET",
        f"{base_url}/reviews/{review_id}?{detail_query}",
        headers=headers,
    )
    assert_success(status_code, body, "review detail")

    status_code, body = request_json(
        "PATCH",
        f"{base_url}/reviews/{review_id}/status?{detail_query}",
        headers=headers,
        payload={"status": "reviewed"},
    )
    assert_success(status_code, body, "review status update")

    status_code, body = request_json(
        "POST",
        f"{base_url}/sentiment/analyze",
        headers=headers,
        payload={"review_id": review_id, "language_hint": "en"},
    )
    assert_success(status_code, body, "sentiment analyze")

    status_code, body = request_json(
        "GET",
        f"{base_url}/sentiment/reviews/{review_id}",
        headers=headers,
    )
    assert_success(status_code, body, "sentiment get")

    status_code, body = request_json(
        "POST",
        f"{base_url}/content/generate/reply",
        headers=headers,
        payload={
            "business_id": business_id,
            "review_id": review_id,
            "language": "en",
            "tone": "professional",
            "business_context": "Smoke Test Cafe",
        },
    )
    assert_success(status_code, body, "content generate reply")
    content_id = body["data"]["generated_content"]["id"]

    status_code, body = request_json(
        "POST",
        f"{base_url}/content/save",
        headers=headers,
        payload={
            "content_id": content_id,
            "edited_text": "Updated smoke reply approved by user.",
        },
    )
    assert_success(status_code, body, "content save")

    status_code, body = request_json(
        "GET",
        f"{base_url}/content/{content_id}",
        headers=headers,
    )
    assert_success(status_code, body, "content get")

    status_code, body = request_json(
        "POST",
        f"{base_url}/content/generate/marketing",
        headers=headers,
        payload={
            "business_id": business_id,
            "language": "en",
            "tone": "friendly",
            "business_context": "Smoke Test Cafe",
            "prompt_context": {"audience": "locals"},
        },
    )
    assert_success(status_code, body, "content generate marketing")

    print("Smoke test completed successfully.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Smoke test failed: {exc}", file=sys.stderr)
        raise
