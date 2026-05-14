# API Reference — Bilingual Sentiment Analysis

This document explains every endpoint, request format, response format, and error code for the sentiment analysis API. It includes copy-paste examples in `curl`, Python, and JavaScript.

---

## Table of Contents

1. [Base URL and Authentication](#1-base-url-and-authentication)
2. [How the API Works](#2-how-the-api-works)
3. [Endpoints Overview](#3-endpoints-overview)
4. [GET /health](#4-get-health)
5. [POST /predict](#5-post-predict)
6. [POST /predict/batch](#6-post-predictbatch)
7. [GET /docs](#7-get-docs)
8. [Response Fields Explained](#8-response-fields-explained)
9. [Error Responses](#9-error-responses)
10. [Code Examples](#10-code-examples)
11. [Input Guidelines](#11-input-guidelines)
12. [Performance Characteristics](#12-performance-characteristics)

---

## 1. Base URL and Authentication

| Environment | Base URL |
|-------------|----------|
| Local (Docker) | `http://localhost:8030` |
| Deployed (example) | `https://your-deployed-url.com` |

The API has **no authentication** by default. If you deploy it publicly, add an API gateway or a reverse proxy (e.g. Nginx, Traefik) with an API key header in front of it.

All requests and responses use `Content-Type: application/json`.

---

## 2. How the API Works

When you send a text to `/predict`, the following steps happen inside the container:

```
Your text
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  1. preprocess_text()                               │
│     • Remove URLs and email addresses               │
│     • Normalise Arabic letter variants (أ إ آ → ا) │
│     • Strip Arabic diacritics (tashkeel)            │
│     • Remove emojis and special symbols             │
│     • Collapse whitespace                           │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  2. XLM-RoBERTa Tokenizer                          │
│     • SentencePiece BPE, 250k vocabulary            │
│     • Handles Arabic + English in one pass          │
│     • Pads/truncates to 128 tokens                  │
│     • Produces input_ids + attention_mask           │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  3. XLM-RoBERTa Base + LoRA Adapter                │
│     • Base model: ~278M parameters (frozen)         │
│     • LoRA adapter: ~1.2M trainable parameters      │
│     • Outputs raw logits for 3 classes              │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  4. Softmax → Probabilities                         │
│     • Converts logits to probabilities (sum = 1.0)  │
│     • Returns label, confidence, all three scores   │
└─────────────────────────────────────────────────────┘
    │
    ▼
JSON response
```

### Label mapping

| Model output index | Label | Meaning |
|-------------------|-------|---------|
| `0` | `NEGATIVE` | Negative sentiment |
| `1` | `NEUTRAL` | Neutral / mixed sentiment |
| `2` | `POSITIVE` | Positive sentiment |

---

## 3. Endpoints Overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Check if the API and model are ready |
| `POST` | `/predict` | Classify a single text |
| `POST` | `/predict/batch` | Classify up to 64 texts in one call |
| `GET` | `/docs` | Interactive Swagger UI |

---

## 4. GET /health

Use this endpoint to check whether the API is running and the model has finished loading.

### Request

```
GET /health
```

No request body or headers required.

### Response — model ready

```json
{
  "status": "ok",
  "model_loaded": true
}
```

### Response — model still loading

```json
{
  "status": "ok",
  "model_loaded": false
}
```

If `model_loaded` is `false`, the container just started and is still downloading or initialising the model. Wait ~30 seconds and retry.

### curl example

```bash
curl http://localhost:8000/health
```

---

## 5. POST /predict

Classify a single piece of text. Accepts Arabic, English, or mixed (code-switched) input.

### Request

```
POST /predict
Content-Type: application/json
```

**Request body:**

```json
{
  "text": "your text here"
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `text` | string | Yes | min 1 character | The text to classify |

### Response

```json
{
  "label": "POSITIVE",
  "confidence": 0.9341,
  "scores": {
    "NEGATIVE": 0.0312,
    "NEUTRAL": 0.0347,
    "POSITIVE": 0.9341
  },
  "processing_time_ms": 47.3
}
```

| Field | Type | Description |
|-------|------|-------------|
| `label` | string | Predicted class: `"NEGATIVE"`, `"NEUTRAL"`, or `"POSITIVE"` |
| `confidence` | float | Probability of the predicted class (0.0 – 1.0) |
| `scores` | object | Probabilities for all three classes (always sum to ~1.0) |
| `processing_time_ms` | float | Time taken to preprocess + tokenize + run inference, in milliseconds |

### curl example

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "المنتج كان amazing جداً"}'
```

### Example inputs and expected outputs

**Positive Arabic:**

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "هذا المنتج رائع جداً وأنصح به بشدة"}'
```

```json
{
  "label": "POSITIVE",
  "confidence": 0.9512,
  "scores": { "NEGATIVE": 0.0201, "NEUTRAL": 0.0287, "POSITIVE": 0.9512 },
  "processing_time_ms": 52.1
}
```

**Negative English:**

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "Terrible experience, completely broken, waste of money"}'
```

```json
{
  "label": "NEGATIVE",
  "confidence": 0.9743,
  "scores": { "NEGATIVE": 0.9743, "NEUTRAL": 0.0189, "POSITIVE": 0.0068 },
  "processing_time_ms": 44.8
}
```

**Neutral / mixed:**

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "The product arrived on time. Nothing special."}'
```

```json
{
  "label": "NEUTRAL",
  "confidence": 0.7821,
  "scores": { "NEGATIVE": 0.1043, "NEUTRAL": 0.7821, "POSITIVE": 0.1136 },
  "processing_time_ms": 41.2
}
```

---

## 6. POST /predict/batch

Classify multiple texts in a single API call. More efficient than calling `/predict` in a loop because the model processes all texts in one forward pass.

### Request

```
POST /predict/batch
Content-Type: application/json
```

**Request body:**

```json
{
  "texts": [
    "first text here",
    "second text here",
    "third text here"
  ]
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `texts` | array of strings | Yes | 1–64 items | List of texts to classify |

### Response

Returns an array of prediction objects in the same order as the input texts.

```json
[
  {
    "label": "POSITIVE",
    "confidence": 0.9341,
    "scores": { "NEGATIVE": 0.0312, "NEUTRAL": 0.0347, "POSITIVE": 0.9341 },
    "processing_time_ms": 18.4
  },
  {
    "label": "NEGATIVE",
    "confidence": 0.8812,
    "scores": { "NEGATIVE": 0.8812, "NEUTRAL": 0.0901, "POSITIVE": 0.0287 },
    "processing_time_ms": 18.4
  },
  {
    "label": "NEUTRAL",
    "confidence": 0.6543,
    "scores": { "NEGATIVE": 0.1821, "NEUTRAL": 0.6543, "POSITIVE": 0.1636 },
    "processing_time_ms": 18.4
  }
]
```

The response array has exactly the same length as the input `texts` array. The order is preserved — index `0` in the response corresponds to index `0` in the request.

### curl example

```bash
curl -X POST http://localhost:8000/predict/batch \
  -H "Content-Type: application/json" \
  -d '{
    "texts": [
      "هذا المنتج رائع جداً",
      "Terrible experience, would not recommend",
      "The package arrived on time"
    ]
  }'
```

### When to use batch vs single

| Scenario | Recommended endpoint |
|----------|---------------------|
| Classifying one user message in real time | `/predict` |
| Processing a list of reviews | `/predict/batch` |
| Classifying more than 64 texts | Split into chunks of 64 and call `/predict/batch` multiple times |

---

## 7. GET /docs

Opens the interactive Swagger UI where you can explore all endpoints and send test requests directly from the browser.

```
GET /docs
```

Navigate to `http://localhost:8000/docs` in your browser. No curl needed.

---

## 8. Response Fields Explained

### `label`

The predicted sentiment class. Always one of:

- `"NEGATIVE"` — the text expresses a negative opinion, complaint, or dissatisfaction
- `"NEUTRAL"` — the text is factual, ambiguous, or neither clearly positive nor negative
- `"POSITIVE"` — the text expresses approval, satisfaction, or praise

### `confidence`

The model's probability for the predicted class, as a float between `0.0` and `1.0`.

- Values above `0.85` indicate high confidence — the model is very sure.
- Values between `0.60` and `0.85` indicate moderate confidence — the text may be ambiguous.
- Values below `0.60` indicate low confidence — treat the prediction with caution.

### `scores`

The full probability distribution across all three classes. These always sum to approximately `1.0` (minor floating-point rounding may cause the sum to be `0.9999` or `1.0001`).

Use `scores` when you need to:
- Show a confidence bar for all three classes in a UI
- Apply a custom threshold (e.g. only act on predictions with `POSITIVE > 0.9`)
- Log the full distribution for analysis

### `processing_time_ms`

Wall-clock time in milliseconds from when the request was received to when the response was serialised. This includes:
- Text preprocessing
- Tokenisation
- Model inference (forward pass)
- Softmax and response serialisation

It does **not** include network latency between the client and the server.

---

## 9. Error Responses

All errors follow this shape:

```json
{
  "detail": "human-readable error message"
}
```

| HTTP Status | When it occurs | Example `detail` |
|-------------|---------------|-----------------|
| `422 Unprocessable Entity` | Request body is missing a required field or has the wrong type | `"field required"` |
| `422 Unprocessable Entity` | `text` field is an empty string | `"min_length"` |
| `422 Unprocessable Entity` | `texts` array has more than 64 items | `"max_items"` |
| `503 Service Unavailable` | Model has not finished loading yet | `"Model not loaded yet"` |
| `500 Internal Server Error` | Unexpected server error | `"Internal Server Error"` |

### Example: missing field

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{}'
```

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "text"],
      "msg": "Field required",
      "input": {}
    }
  ]
}
```

### Example: model not ready

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "hello"}'
```

```json
{
  "detail": "Model not loaded yet"
}
```

---

## 10. Code Examples

### Python (using `requests`)

```python
import requests

BASE_URL = "http://localhost:8000"

# Single prediction
response = requests.post(
    f"{BASE_URL}/predict",
    json={"text": "المنتج كان amazing جداً"}
)
result = response.json()

print(result["label"])        # "POSITIVE"
print(result["confidence"])   # 0.9341
print(result["scores"])       # {"NEGATIVE": 0.0312, "NEUTRAL": 0.0347, "POSITIVE": 0.9341}
```

```python
# Batch prediction
texts = [
    "هذا المنتج رائع جداً",
    "Terrible experience",
    "It was okay, nothing special",
]

response = requests.post(
    f"{BASE_URL}/predict/batch",
    json={"texts": texts}
)
results = response.json()

for text, result in zip(texts, results):
    print(f"{text!r:50s} → {result['label']} ({result['confidence']:.2%})")
```

### Python (using `httpx` for async)

```python
import asyncio
import httpx

BASE_URL = "http://localhost:8000"

async def classify(text: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/predict",
            json={"text": text}
        )
        response.raise_for_status()
        return response.json()

result = asyncio.run(classify("هذا رائع"))
print(result)
```

### JavaScript / Node.js (using `fetch`)

```javascript
const BASE_URL = "http://localhost:8000";

// Single prediction
async function predict(text) {
  const response = await fetch(`${BASE_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Batch prediction
async function predictBatch(texts) {
  const response = await fetch(`${BASE_URL}/predict/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Usage
predict("المنتج كان amazing جداً").then(console.log);

predictBatch(["great product", "سيء جداً"]).then(console.log);
```

### TypeScript (with type definitions)

```typescript
const BASE_URL = "http://localhost:8000";

interface SentimentResult {
  label: "NEGATIVE" | "NEUTRAL" | "POSITIVE";
  confidence: number;
  scores: {
    NEGATIVE: number;
    NEUTRAL: number;
    POSITIVE: number;
  };
  processing_time_ms: number;
}

async function predict(text: string): Promise<SentimentResult> {
  const response = await fetch(`${BASE_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json() as Promise<SentimentResult>;
}

async function predictBatch(texts: string[]): Promise<SentimentResult[]> {
  const response = await fetch(`${BASE_URL}/predict/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json() as Promise<SentimentResult[]>;
}
```

---

## 11. Input Guidelines

### What the model handles well

- **Modern Standard Arabic (MSA)** — news articles, formal writing
- **Gulf Arabic dialect** — Saudi, Emirati, Kuwaiti colloquial
- **Egyptian Arabic dialect** — the most common dialect online
- **Levantine Arabic dialect** — Syrian, Lebanese, Palestinian, Jordanian
- **English** — any register, formal or informal
- **Code-switched text** — Arabic and English mixed in the same sentence (e.g. `"المنتج كان amazing جداً"`)

### Character limits

There is no hard character limit enforced by the API. However, the tokeniser truncates all input to **128 tokens** (the value of `MAX_LENGTH`). For XLM-RoBERTa, 128 tokens corresponds to roughly:

- ~80–100 Arabic words
- ~90–110 English words

Text beyond 128 tokens is silently truncated. For most reviews and short messages, this is not an issue.

### Empty or whitespace-only input

If the text is empty, whitespace-only, or becomes empty after preprocessing (e.g. a string containing only URLs or emojis), the API returns:

```json
{
  "label": "NEUTRAL",
  "confidence": 0.0,
  "scores": { "NEGATIVE": 0.0, "NEUTRAL": 0.0, "POSITIVE": 0.0 },
  "processing_time_ms": 0.0
}
```

A `confidence` of `0.0` signals that no real prediction was made.

### What the model does not handle

- **Moroccan Darija** — partially supported; accuracy is lower than other dialects
- **Sarcasm and irony** — the model classifies the literal sentiment of the words
- **Very long documents** — only the first ~128 tokens are considered; the rest is ignored

---

## 12. Performance Characteristics

| Metric | CPU (2 vCPU) | GPU (T4) |
|--------|-------------|----------|
| Single request latency | ~80–150 ms | ~20–50 ms |
| Batch of 16 texts | ~300–500 ms | ~60–100 ms |
| Batch of 64 texts | ~1000–1800 ms | ~200–350 ms |
| Model load time (cold start, cached) | ~15–25 s | ~10–15 s |
| Model load time (cold start, no cache) | ~3–5 min | ~3–5 min |
| RAM usage at runtime | ~2.0–2.5 GB | ~2.0–2.5 GB |

These are approximate values measured on a 2 vCPU / 4 GB RAM instance. Actual performance depends on text length and hardware.
