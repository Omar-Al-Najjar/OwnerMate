# Google Reviews API

A FastAPI service that fetches Google Maps reviews for any business by name. It delegates all scraping to the [gosom/google-maps-scraper](https://github.com/gosom/google-maps-scraper) open-source tool running as a local Docker container.

## Architecture

```
Client → FastAPI (port 8000) → google-maps-scraper (internal, port 8080)
```

The FastAPI service:
1. Accepts a business name via REST API
2. Creates a scraping job on the google-maps-scraper web server
3. Polls until the job completes (3-5 minutes minimum)
4. Downloads the CSV result and extracts reviews
5. Returns the reviews as JSON

## Requirements

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Quick Start

```bash
docker compose up --build
```

This starts both services:
- `scraper` — google-maps-scraper web server (internal)
- `api` — FastAPI service on http://localhost:8000

## Usage

### Get reviews for a business

```bash
curl -X POST http://localhost:8000/reviews \
  -H "Content-Type: application/json" \
  -d '{"business_name": "Starbucks Times Square New York"}'
```

**Response:**

```json
{
  "business_name": "Starbucks Times Square New York",
  "reviews": [
    {
      "author": "John Doe",
      "rating": 4.0,
      "text": "Great coffee, busy location but staff is friendly.",
      "date": "2 months ago"
    }
  ]
}
```

### Request body parameters

| Field           | Type    | Default | Description                                             |
|-----------------|---------|---------|----------------------------------------------------------|
| `business_name` | string  | required | Business name to search on Google Maps                  |
| `depth`         | integer | `1`     | Scroll depth in search results (more = more businesses)  |
| `lang`          | string  | `"en"`  | Language code for results (e.g. `"de"`, `"fr"`)         |

### Health check

```bash
curl http://localhost:8000/health
```

### Interactive API docs

Open http://localhost:8000/docs in your browser for the Swagger UI.

## Important Notes

- **Scraping takes time.** Each request takes a minimum of 3-5 minutes because the scraper needs to open a real browser, navigate Google Maps, and scroll through results. The API will hold the HTTP connection open until results are ready.
- **Be specific with business names.** The more specific the name (include city/neighborhood), the more relevant the results.
- **Results include reviews from the first matching businesses** found by Google Maps for the given query. Adjust `depth` to search more broadly.

## Project Structure

```
.
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI app and /reviews endpoint
│   ├── models.py         # Pydantic request/response models
│   └── scraper_client.py # Scraper REST API integration
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── README.md
```

## Development

Run locally without Docker (requires the scraper to be running separately):

```bash
pip install -r requirements.txt

# Start the scraper separately
mkdir -p gmapsdata
docker run -v $PWD/gmapsdata:/gmapsdata -p 8080:8080 gosom/google-maps-scraper -data-folder /gmapsdata

# Start the API
SCRAPER_BASE_URL=http://localhost:8080 uvicorn app.main:app --reload
```

## Environment Variables

| Variable           | Default                  | Description                  |
|--------------------|--------------------------|------------------------------|
| `SCRAPER_BASE_URL` | `http://localhost:8080`  | URL of the scraper web server |
