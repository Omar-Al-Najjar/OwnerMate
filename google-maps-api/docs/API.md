# API Reference

Base URL: `https://your-domain.com` (or `http://localhost:8000` for local development)

---

## Overview

The Google Reviews API scrapes Google Maps reviews for a given business name. It uses a real browser under the hood to interact with Google Maps, so **each request takes 5-10 minutes** to complete. Plan your integration accordingly — do not call this API in a synchronous user-facing flow. Instead, call it from a background job or scheduler and store the results in your own database.

---

## Endpoints

### POST /reviews

Scrapes Google Maps for the given business name and returns its reviews.

**This is a long-running request.** Keep the HTTP connection open and wait for the response. The request will not return until scraping is complete (or until it times out after ~12 minutes).

#### Request

```
POST /reviews
Content-Type: application/json
```

#### Request Body

```json
{
  "business_name": "Starbucks Times Square New York",
  "depth": 1,
  "lang": "en"
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `business_name` | string | Yes | — | The name of the business to search on Google Maps. Be as specific as possible — include the city or neighborhood for best results. Supports any language including Arabic. |
| `depth` | integer | No | `1` | How deep to scroll through Google Maps search results. `1` returns the first page of results (~20 businesses). Higher values search more broadly but take longer. Min: `1`, Max: `10`. |
| `lang` | string | No | `"en"` | ISO 639-1 two-letter language code for the search results. Controls the language of the returned review text and business data. Examples: `"en"`, `"ar"`, `"de"`, `"fr"`, `"es"`. |

#### Response

```
HTTP 200 OK
Content-Type: application/json
```

```json
{
  "business_name": "Starbucks Times Square New York",
  "reviews": [
    {
      "author": "John Doe",
      "rating": 4.0,
      "text": "Great coffee, busy location but staff is friendly."
    },
    {
      "author": "Jane Smith",
      "rating": 2.0,
      "text": "Too crowded, waited 15 minutes for a simple order."
    }
  ]
}
```

#### Response Fields

**Top level:**

| Field | Type | Description |
|---|---|---|
| `business_name` | string | The business name as provided in the request. |
| `reviews` | array | List of review objects. Empty array `[]` if no reviews were found. |

**Each review object:**

| Field | Type | Description |
|---|---|---|
| `author` | string or null | The display name of the reviewer. |
| `rating` | number or null | Star rating given by the reviewer. Value is between `1.0` and `5.0`. |
| `text` | string or null | The full text of the review. May contain newlines. May be in any language depending on the reviewer. |

#### Notes on Results

- Reviews are returned for the **first matching business** found by Google Maps for the given query. If your query matches multiple businesses (e.g. a chain), reviews from the top result are returned.
- The number of reviews returned depends on what Google Maps surfaces for that business — typically 5 to 20 reviews per scrape.
- `rating`, `author`, and `text` can be `null` if Google Maps did not provide that data for a specific review.

---

#### Error Responses

**422 Unprocessable Entity** — Invalid request body.

Returned when required fields are missing or field values fail validation (e.g. `lang` is not 2 characters).

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "business_name"],
      "msg": "Field required"
    }
  ]
}
```

```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body", "lang"],
      "msg": "Value error, lang must be a 2-letter ISO 639-1 language code (e.g. 'en', 'ar', 'de')"
    }
  ]
}
```

**502 Bad Gateway** — The scraper failed or timed out.

Returned when the underlying scraper encountered an error or the job did not complete within the timeout window (~12 minutes).

```json
{
  "detail": "Scraper job abc123 failed"
}
```

---

### GET /health

Returns the health status of the API. Use this to verify the service is running before sending scrape requests.

#### Request

```
GET /health
```

#### Response

```
HTTP 200 OK
Content-Type: application/json
```

```json
{
  "status": "ok"
}
```

---

## Usage Examples

### cURL

```bash
curl -X POST https://your-domain.com/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "business_name": "Adidas Outlet Store Airport Road Amman",
    "depth": 1,
    "lang": "en"
  }'
```

### Python (httpx)

```python
import httpx

# Note: timeout must be long enough for the scraper to finish
client = httpx.Client(timeout=900)

response = client.post(
    "https://your-domain.com/reviews",
    json={
        "business_name": "Adidas Outlet Store Airport Road Amman",
        "depth": 1,
        "lang": "en",
    }
)

data = response.json()
for review in data["reviews"]:
    print(f"{review['author']} ({review['rating']}★): {review['text']}")
```

### Python (requests)

```python
import requests

response = requests.post(
    "https://your-domain.com/reviews",
    json={
        "business_name": "Adidas Outlet Store Airport Road Amman",
        "depth": 1,
        "lang": "en",
    },
    timeout=900  # 15 minutes — must be longer than the scraper's max runtime
)

data = response.json()
for review in data["reviews"]:
    print(f"{review['author']} ({review['rating']}★): {review['text']}")
```

### JavaScript (fetch)

```javascript
const response = await fetch("https://your-domain.com/reviews", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    business_name: "Adidas Outlet Store Airport Road Amman",
    depth: 1,
    lang: "en",
  }),
  // Note: browser fetch does not support custom timeouts natively.
  // Use axios or call this from a backend, not directly from the browser.
});

const data = await response.json();
data.reviews.forEach(review => {
  console.log(`${review.author} (${review.rating}★): ${review.text}`);
});
```

### Arabic Business Name

```bash
curl -X POST https://your-domain.com/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "business_name": "ماكدونالدز عمّان",
    "depth": 1,
    "lang": "ar"
  }'
```

---

## Integration Tips

### Set a Long Timeout

Every HTTP client has a default timeout (usually 30 seconds) that will cut the connection before the scraper finishes. Always set your client timeout to at least **900 seconds (15 minutes)**:

| Client | How to set timeout |
|---|---|
| Python `requests` | `requests.post(..., timeout=900)` |
| Python `httpx` | `httpx.Client(timeout=900)` |
| Node.js `axios` | `axios.post(..., { timeout: 900000 })` |
| Go `http.Client` | `client.Timeout = 15 * time.Minute` |

### Call from a Background Job, Not a User Request

Because each scrape takes 5-10 minutes, never call this API directly from a user-facing HTTP request. Instead:

1. When a user adds a business to monitor, enqueue a background job
2. The background job calls `POST /reviews` and waits for the result
3. Store the returned reviews in your own database
4. Serve the stored reviews to your users instantly from your database

### Be Specific with Business Names

The more specific the business name, the more accurate the results:

| Less specific | More specific |
|---|---|
| `"Starbucks"` | `"Starbucks Times Square New York"` |
| `"McDonald's"` | `"McDonald's Airport Road Amman Jordan"` |
| `"Adidas"` | `"Adidas Outlet Store Airport Road Amman"` |

### Concurrency

The API supports multiple simultaneous requests. By default the server processes up to **4 scrapes in parallel** (configurable). If you send more requests than the concurrency limit, they are queued and processed in order. Each queued request will still eventually return — it just waits longer.

---

## Interactive Documentation

When the API is running, full interactive documentation (Swagger UI) is available at:

```
http://localhost:8000/docs        (local)
https://your-domain.com/docs     (production)
```

The ReDoc version is available at:

```
https://your-domain.com/redoc
```
