# Codebase Reference

This document explains what every file in the project does, how they relate to each other, and where to make changes for common tasks.

---

## Project Structure

```
google maps scraper/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── models.py
│   └── scraper_client.py
├── docs/
│   ├── API.md
│   ├── CODEBASE.md
│   └── DEPLOYMENT.md
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── README.md
```

---

## app/

The Python package that contains all application logic. Every file in here is part of the FastAPI service.

---

### app/\_\_init\_\_.py

An empty file that tells Python to treat the `app/` directory as a package. This is what allows files inside `app/` to import each other using `from app.models import ...` syntax. You never need to edit this file.

---

### app/models.py

**What it does:** Defines the shape of data going into and out of the API using Pydantic models. Every request body and every response is validated and serialized through these classes.

**Classes:**

**`ReviewsRequest`** — The body of the `POST /reviews` request. Pydantic automatically validates incoming JSON against this model before the endpoint function even runs. If a field is missing or invalid, a `422` error is returned automatically.

| Field | Type | Rule |
|---|---|---|
| `business_name` | string | Required. Cannot be empty. |
| `depth` | integer | Optional. Defaults to `1`. Must be between `1` and `10`. |
| `lang` | string | Optional. Defaults to `"en"`. Must be exactly 2 characters (ISO 639-1). Automatically lowercased. |

The `lang_must_be_two_chars` validator enforces the 2-character rule and converts the value to lowercase before it reaches the endpoint. This prevents the scraper from rejecting the job due to an invalid language code.

**`Review`** — Represents a single review in the response. All fields are optional (`None`) because the scraper does not always return every field for every review.

| Field | Type |
|---|---|
| `author` | string or null |
| `rating` | float or null |
| `text` | string or null |

**`ReviewsResponse`** — The full response body returned by `POST /reviews`.

| Field | Type |
|---|---|
| `business_name` | string |
| `reviews` | list of `Review` objects |

**When to edit this file:**
- To add or remove fields from the request (e.g. add a `max_results` parameter)
- To add or remove fields from the response (e.g. add `profile_picture` to each review)
- To change validation rules (e.g. change the max allowed `depth`)

---

### app/scraper_client.py

**What it does:** Handles all communication with the `gosom/google-maps-scraper` container. This is the core integration layer — it knows how to create a scraping job, wait for it to finish, download the result, and extract the review data from it.

**How the scraper works (background):**

The scraper runs as a separate Docker container with its own internal REST API on port `8080`. It accepts jobs, runs a real Chromium browser to scrape Google Maps, saves results as a CSV file, and marks the job as complete. Our FastAPI service talks to this internal API.

**Constants at the top of the file:**

| Constant | Value | Purpose |
|---|---|---|
| `SCRAPER_BASE_URL` | `http://localhost:8080` (default) | URL of the scraper container. Overridden by the `SCRAPER_BASE_URL` environment variable in production (set to `http://scraper:8080` in Docker Compose). |
| `SCRAPER_MAX_TIME` | `600` | How many seconds the scraper is allowed to run per job. Sent in the job payload. |
| `POLL_INITIAL_DELAY` | `10.0` | Seconds to wait before the first status check after creating a job. |
| `POLL_MAX_DELAY` | `30.0` | Maximum seconds between status checks (the delay grows but is capped here). |
| `POLL_BACKOFF_FACTOR` | `1.5` | Each poll waits 1.5× longer than the previous one (exponential backoff). |
| `POLL_TIMEOUT` | `720.0` | Total seconds before giving up on a job (`SCRAPER_MAX_TIME + 120`). Always larger than `SCRAPER_MAX_TIME`. |

**`ScraperError`** — A custom exception class. Raised whenever something goes wrong with the scraper (job creation failed, job failed, timed out, CSV not found). Caught in `main.py` and converted to an HTTP `502` response.

**Functions:**

**`get_reviews(business_name, depth, lang)`** — The only public function in this file. Called by `main.py`. Runs the full pipeline in order:
1. Creates a job on the scraper
2. Waits for the job to complete
3. Downloads the CSV result
4. Parses and returns the reviews

**`_create_job(client, business_name, depth, lang)`** — Sends a `POST /api/v1/jobs` request to the scraper container with the job parameters. Returns the job ID (a UUID string) on success. Raises `ScraperError` if the request fails or no job ID is returned.

The payload sent to the scraper includes fixed settings (zoom level, search radius, no email extraction, no fast mode) alongside the user-provided parameters.

**`_wait_for_job(client, job_id)`** — Polls `GET /api/v1/jobs/{job_id}` repeatedly until the job status is `"ok"` (success) or `"failed"`. Uses exponential backoff — starts checking every 10 seconds, gradually increases to every 30 seconds. Raises `ScraperError` if the job fails or the total wait exceeds `POLL_TIMEOUT`.

**`_download_csv(client, job_id)`** — Fetches the completed CSV file from `GET /api/v1/jobs/{job_id}/download`. Returns the raw CSV text as a string. Raises `ScraperError` if the file is not found.

**`_parse_reviews(csv_text)`** — Parses the raw CSV text and extracts review data. The CSV has many columns (address, phone, rating, etc.) but we only read the `user_reviews` column. That column contains a JSON array of review objects serialized as a string inside the CSV cell. Each review object has the fields `Name`, `Rating`, `Description`, and others — these are the exact field names from the Go scraper's internal struct. Returns a list of plain dicts with keys `author`, `rating`, and `text`.

**When to edit this file:**
- To change how long the scraper is allowed to run (`SCRAPER_MAX_TIME`)
- To change polling behavior (delays, timeout)
- To extract additional fields from the CSV (e.g. business phone number, address)
- To change the scraper job parameters (e.g. enable email extraction, change zoom level)

---

### app/main.py

**What it does:** Creates the FastAPI application, registers the HTTP endpoints, and connects the request/response layer to the scraper client.

**The FastAPI app instance** is created at the top with a title, description, and version. These appear in the auto-generated Swagger docs at `/docs`.

**`POST /reviews` endpoint** — The main endpoint. It:
1. Receives a validated `ReviewsRequest` from the request body (validation is handled automatically by Pydantic/FastAPI)
2. Calls `get_reviews()` from `scraper_client.py`
3. If `ScraperError` is raised, converts it to an HTTP `502` response
4. Maps the raw review dicts into `Review` Pydantic objects
5. Returns a `ReviewsResponse`

**`GET /health` endpoint** — Returns `{"status": "ok"}`. Used to verify the service is running. Does not touch the scraper.

**When to edit this file:**
- To add new endpoints
- To change error handling behavior (e.g. return a different status code)
- To add request authentication (e.g. API key header check)
- To add response headers or middleware (e.g. CORS)

---

## Root-level Files

### docker-compose.yml

Defines and connects the two Docker containers that make up the full service:

**`scraper` service** — Runs the `gosom/google-maps-scraper` image in web server mode. The `-c 4` flag sets concurrency to 4 parallel browser tabs. The `-data-folder /gmapsdata` flag points to a Docker volume where job data and CSV files are stored. This container is only accessible internally — it is not exposed to the internet.

**`api` service** — Builds and runs the FastAPI application from the local `Dockerfile`. Exposed on port `8000`. Receives the scraper's internal URL via the `SCRAPER_BASE_URL` environment variable. The uvicorn command sets `--workers 4` (4 parallel worker processes) and long timeouts to handle requests that take many minutes.

**`internal` network** — Both containers share this private Docker network, which is how the API container reaches the scraper container by hostname (`http://scraper:8080`).

**`gmapsdata` volume** — Persistent storage for the scraper's job database and CSV output files. Survives container restarts.

**When to edit this file:**
- To change the scraper concurrency (`-c 4`)
- To change the number of API workers (`--workers 4`)
- To add environment variables
- To change the exposed port (`8000`)

---

### Dockerfile

Defines how the FastAPI service Docker image is built. It uses Python 3.12 slim as the base, installs dependencies from `requirements.txt`, copies the `app/` folder into the image, and sets uvicorn as the startup command.

**When to edit this file:**
- To upgrade the Python version
- To add system-level dependencies (e.g. `apt-get install`)

---

### requirements.txt

Lists the Python packages the FastAPI service depends on:

| Package | Purpose |
|---|---|
| `fastapi` | The web framework — handles routing, request parsing, response serialization, and auto-generates the `/docs` Swagger UI |
| `uvicorn[standard]` | The ASGI server that runs FastAPI — handles incoming HTTP connections |
| `httpx` | Async HTTP client used in `scraper_client.py` to communicate with the scraper container |
| `python-multipart` | Required by FastAPI to handle form data (included for completeness even though we only use JSON) |

**When to edit this file:**
- To add a new Python library
- To pin a specific version of a dependency
