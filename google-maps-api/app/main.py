import asyncio

from fastapi import FastAPI, HTTPException, Query, status

from app.models import (
    ReviewCandidateSearchRequest,
    ReviewJobCreateRequest,
    ReviewJobRead,
    ReviewJobReviewsResponse,
    ReviewsRequest,
    ReviewsResponse,
)
from app.review_jobs import ReviewJobManager
from app.scraper_client import ScraperError, get_reviews

app = FastAPI(
    title="Google Reviews API",
    description=(
        "Fetch Google Maps reviews and manage background review collection jobs "
        "powered by google-maps-scraper."
    ),
    version="2.0.0",
)

job_manager = ReviewJobManager()


@app.post("/reviews", response_model=ReviewsResponse, summary="Get reviews for a business")
async def reviews(request: ReviewsRequest) -> ReviewsResponse:
    try:
        raw_reviews = await get_reviews(
            business_name=request.business_name,
            depth=request.depth,
            lang=request.lang,
        )
    except ScraperError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return ReviewsResponse(
        business_name=request.business_name,
        reviews=raw_reviews,
    )


@app.post(
    "/review-candidates",
    summary="Search for Google place candidates",
)
async def review_candidates(request: ReviewCandidateSearchRequest):
    payload = ReviewJobCreateRequest(
        business_name=request.business_name,
        lang=request.lang,
        depth=request.depth,
    )
    return await job_manager.search_candidates(payload)


@app.post(
    "/review-jobs",
    response_model=ReviewJobRead,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Create a background Google review job",
)
async def create_review_job(request: ReviewJobCreateRequest) -> ReviewJobRead:
    job = job_manager.create_job(request)
    asyncio.create_task(job_manager.run_job(job.job_id))
    return job


@app.get(
    "/review-jobs/{job_id}",
    response_model=ReviewJobRead,
    summary="Get background Google review job status",
)
async def get_review_job(job_id: str) -> ReviewJobRead:
    return job_manager.get_job(job_id)


@app.get(
    "/review-jobs/{job_id}/reviews",
    response_model=ReviewJobReviewsResponse,
    summary="Download reviews from a completed Google review job",
)
async def get_review_job_reviews(
    job_id: str,
    business_name: str = Query(..., min_length=1),
    candidate_id: str | None = Query(default=None),
) -> ReviewJobReviewsResponse:
    del business_name
    return await job_manager.get_job_reviews(job_id=job_id, candidate_id=candidate_id)


@app.get("/health", summary="Health check")
async def health() -> dict:
    return {"status": "ok"}
