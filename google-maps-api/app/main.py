from fastapi import FastAPI, HTTPException

from app.models import Review, ReviewsRequest, ReviewsResponse
from app.scraper_client import ScraperError, get_reviews

app = FastAPI(
    title="Google Reviews API",
    description="Fetch Google Maps reviews for a business by name, powered by google-maps-scraper.",
    version="1.0.0",
)


@app.post("/reviews", response_model=ReviewsResponse, summary="Get reviews for a business")
async def reviews(request: ReviewsRequest) -> ReviewsResponse:
    """
    Submit a business name and receive its Google Maps reviews.

    - **business_name**: Name of the business to search (e.g. "Starbucks New York")
    - **depth**: How deep to scroll search results (1 = fast, higher = more results)
    - **lang**: Language code for results (default: "en")

    Note: Scraping takes at least 3-5 minutes per request.
    """
    try:
        raw_reviews = await get_reviews(
            business_name=request.business_name,
            depth=request.depth,
            lang=request.lang,
        )
    except ScraperError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    reviews_out = [
        Review(
            author=r.get("author"),
            rating=r.get("rating"),
            text=r.get("text"),
        )
        for r in raw_reviews
    ]

    return ReviewsResponse(
        business_name=request.business_name,
        reviews=reviews_out,
    )


@app.get("/health", summary="Health check")
async def health() -> dict:
    return {"status": "ok"}
