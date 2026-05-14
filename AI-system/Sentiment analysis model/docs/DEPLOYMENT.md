# Deployment Guide — Bilingual Sentiment API

This guide covers how to build, test, and deploy the sentiment analysis API to the cloud. It includes cost estimates, trade-offs, and step-by-step instructions for three platforms.

---

## Table of Contents

1. [Before You Deploy](#1-before-you-deploy)
2. [Build and Test Locally](#2-build-and-test-locally)
3. [Platform Comparison](#3-platform-comparison)
4. [Option A — Railway (Recommended for Simplicity)](#4-option-a--railway-recommended-for-simplicity)
5. [Option B — Google Cloud Run (Recommended for Scale)](#5-option-b--google-cloud-run-recommended-for-scale)
6. [Option C — AWS ECS Fargate](#6-option-c--aws-ecs-fargate)
7. [Environment Variables Reference](#7-environment-variables-reference)
8. [Post-Deployment Checklist](#8-post-deployment-checklist)
9. [Cost Optimisation Tips](#9-cost-optimisation-tips)

---

## 1. Before You Deploy

### What the container does at startup

When the container starts, it:

1. Downloads the base model `FacebookAI/xlm-roberta-base` (~1.1 GB) from HuggingFace into the cache directory.
2. Loads the LoRA adapter weights from `/app/model/adapter_model.safetensors` (~5 MB).
3. Starts the Uvicorn server and begins accepting requests.

> **Important:** The first cold start takes 2–4 minutes because of the model download. All subsequent starts use the cached weights and take ~15–30 seconds. Always mount a persistent volume for the HuggingFace cache (`HF_HOME`) to avoid re-downloading on every restart.

### Requirements

- Docker installed and running locally
- An account on your chosen cloud platform
- The built Docker image (instructions below)

---

## 2. Build and Test Locally

Always verify the image works locally before pushing to a registry.

```bash
# Navigate to the project root
cd /path/to/sentiment

# Build the image
docker build -t sentiment-api .

# Run it
docker compose up

# In another terminal, test the health endpoint
curl http://localhost:8030/health
# Expected: {"status":"ok","model_loaded":true}

# Test a prediction
curl -X POST http://localhost:8030/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "المنتج كان amazing جداً"}'
```

If the health check returns `"model_loaded": false`, the container is still downloading the base model. Wait 30 seconds and retry.

When running beside the main OwnerMate backend locally, this repository now maps the sentiment service to host port `8030` by default so it does not conflict with the backend on `8000`.

---

## 3. Platform Comparison

| | Railway | Google Cloud Run | AWS ECS Fargate |
|---|---|---|---|
| **Setup difficulty** | Very easy | Medium | Hard |
| **Free tier** | $5/month credit | 2M requests/month free | None |
| **Estimated monthly cost (low traffic)** | ~$5–10 | ~$3–8 | ~$15–30 |
| **Estimated monthly cost (medium traffic)** | ~$20–40 | ~$10–25 | ~$30–60 |
| **Cold start** | ~20–40s | ~30–60s | ~30–60s |
| **Persistent volume for HF cache** | Yes (built-in) | Yes (Cloud Storage FUSE) | Yes (EFS) |
| **Custom domain** | Yes (free) | Yes (free) | Yes (via ALB, paid) |
| **GPU support** | No | No (use Vertex AI) | No (use EC2) |
| **Best for** | Prototypes, small projects | Production, auto-scaling | Enterprise, existing AWS infra |

**Recommendation:** Start with Railway for the lowest friction. Migrate to Cloud Run when you need auto-scaling or SLAs.

---

## 4. Option A — Railway (Recommended for Simplicity)

Railway deploys directly from your GitHub repository or a local Docker image. No registry setup required.

### Step 1 — Install the Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### Step 2 — Initialise the project

Run this from the `sentiment/` directory:

```bash
railway init
# Choose "Empty project" when prompted
# Give it a name, e.g. "sentiment-api"
```

### Step 3 — Add a persistent volume for the HuggingFace cache

In the Railway dashboard:

1. Open your project → **Add Service** → **Volume**
2. Name it `hf-cache`
3. Mount path: `/app/.cache/huggingface`

This ensures the ~1.1 GB base model is only downloaded once.

### Step 4 — Set environment variables

In the Railway dashboard → your service → **Variables**, add:

```
BASE_MODEL=FacebookAI/xlm-roberta-base
MODEL_DIR=/app/model
MAX_LENGTH=128
PORT=8000
WORKERS=1
HF_HOME=/app/.cache/huggingface
```

### Step 5 — Deploy

```bash
railway up
```

Railway will build the Dockerfile and deploy it. The first deploy takes 3–5 minutes.

### Step 6 — Get your public URL

```bash
railway domain
```

This outputs a URL like `https://sentiment-api-production.up.railway.app`. Test it:

```bash
curl https://sentiment-api-production.up.railway.app/health
```

### Estimated cost on Railway

| Usage | Monthly cost |
|-------|-------------|
| Idle (no traffic) | ~$0 (sleeps after inactivity) |
| Low traffic (< 1k requests/day) | ~$5–10 |
| Medium traffic (< 50k requests/day) | ~$15–25 |

Railway charges by CPU + RAM usage per second. The model uses ~1.5–2 GB RAM at runtime.

---

## 5. Option B — Google Cloud Run (Recommended for Scale)

Cloud Run is serverless — you pay only for the time requests are being processed. It scales to zero when idle (no traffic = no cost).

### Prerequisites

- Google Cloud account with billing enabled
- `gcloud` CLI installed: https://cloud.google.com/sdk/docs/install

### Step 1 — Authenticate and configure

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud auth configure-docker
```

Replace `YOUR_PROJECT_ID` with your actual GCP project ID (e.g. `my-sentiment-project-123`).

### Step 2 — Enable required APIs

```bash
gcloud services enable run.googleapis.com containerregistry.googleapis.com
```

### Step 3 — Build and push the image

```bash
# Build locally
docker build -t sentiment-api .

# Tag for Google Container Registry
docker tag sentiment-api gcr.io/YOUR_PROJECT_ID/sentiment-api:latest

# Push
docker push gcr.io/YOUR_PROJECT_ID/sentiment-api:latest
```

> **Tip:** If you are on an ARM Mac (M1/M2/M3), build for the correct platform:
> ```bash
> docker buildx build --platform linux/amd64 -t gcr.io/YOUR_PROJECT_ID/sentiment-api:latest --push .
> ```

### Step 4 — Create a Cloud Storage bucket for the HuggingFace cache

This avoids re-downloading the 1.1 GB base model on every cold start.

```bash
gsutil mb -l us-central1 gs://YOUR_PROJECT_ID-hf-cache
```

### Step 5 — Deploy to Cloud Run

```bash
gcloud run deploy sentiment-api \
  --image gcr.io/YOUR_PROJECT_ID/sentiment-api:latest \
  --platform managed \
  --region us-central1 \
  --memory 4Gi \
  --cpu 2 \
  --timeout 120 \
  --concurrency 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars BASE_MODEL=FacebookAI/xlm-roberta-base,MODEL_DIR=/app/model,MAX_LENGTH=128,PORT=8000,WORKERS=1,HF_HOME=/tmp/hf_cache \
  --allow-unauthenticated
```

**Parameter notes:**
- `--memory 4Gi` — the model needs ~2 GB; 4 GB gives headroom for batch requests
- `--cpu 2` — minimum for acceptable inference latency (~100–200 ms per request)
- `--concurrency 1` — one request per instance; prevents OOM errors from parallel loads
- `--min-instances 0` — scales to zero when idle (cheapest option)
- `--timeout 120` — allows time for cold start + inference

### Step 6 — Get your URL

```bash
gcloud run services describe sentiment-api \
  --platform managed \
  --region us-central1 \
  --format "value(status.url)"
```

Test it:

```bash
curl https://YOUR-SERVICE-URL/health
```

### Estimated cost on Cloud Run

| Usage | Monthly cost |
|-------|-------------|
| Idle (scales to zero) | ~$0 |
| 10k requests/month | ~$1–3 |
| 100k requests/month | ~$5–15 |
| 1M requests/month | ~$30–60 |

Cloud Run pricing: CPU ($0.00002400/vCPU-second) + Memory ($0.00000250/GB-second) + Requests ($0.40/million).

### Keeping instances warm (optional)

If cold starts are unacceptable for your use case, set `--min-instances 1`. This keeps one instance always running and costs ~$30–40/month for 2 vCPU + 4 GB.

---

## 6. Option C — AWS ECS Fargate

Use this option if your infrastructure is already on AWS or you need fine-grained IAM control.

### Prerequisites

- AWS account with billing enabled
- `aws` CLI installed and configured: `aws configure`
- Docker installed

### Step 1 — Create an ECR repository

```bash
aws ecr create-repository \
  --repository-name sentiment-api \
  --region us-east-1
```

Note the `repositoryUri` from the output (e.g. `123456789.dkr.ecr.us-east-1.amazonaws.com/sentiment-api`).

### Step 2 — Authenticate Docker to ECR

```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789.dkr.ecr.us-east-1.amazonaws.com
```

### Step 3 — Build and push

```bash
docker build -t sentiment-api .

docker tag sentiment-api \
  123456789.dkr.ecr.us-east-1.amazonaws.com/sentiment-api:latest

docker push \
  123456789.dkr.ecr.us-east-1.amazonaws.com/sentiment-api:latest
```

### Step 4 — Create an EFS volume for the HuggingFace cache

In the AWS Console:

1. Go to **EFS** → **Create file system**
2. Name it `hf-cache`, place it in the same VPC as your ECS cluster
3. Note the **File System ID** (e.g. `fs-0abc1234`)

### Step 5 — Create a Fargate task definition

Create a file `task-definition.json`:

```json
{
  "family": "sentiment-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "2048",
  "memory": "4096",
  "containerDefinitions": [
    {
      "name": "sentiment-api",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/sentiment-api:latest",
      "portMappings": [{ "containerPort": 8000, "protocol": "tcp" }],
      "environment": [
        { "name": "BASE_MODEL", "value": "FacebookAI/xlm-roberta-base" },
        { "name": "MODEL_DIR", "value": "/app/model" },
        { "name": "MAX_LENGTH", "value": "128" },
        { "name": "PORT", "value": "8000" },
        { "name": "WORKERS", "value": "1" },
        { "name": "HF_HOME", "value": "/mnt/hf_cache" }
      ],
      "mountPoints": [
        { "sourceVolume": "hf-cache", "containerPath": "/mnt/hf_cache" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/sentiment-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ],
  "volumes": [
    {
      "name": "hf-cache",
      "efsVolumeConfiguration": { "fileSystemId": "fs-0abc1234" }
    }
  ]
}
```

Register it:

```bash
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --region us-east-1
```

### Step 6 — Create an ECS cluster and service

```bash
# Create cluster
aws ecs create-cluster --cluster-name sentiment-cluster --region us-east-1

# Create service (replace subnet and security group IDs with yours)
aws ecs create-service \
  --cluster sentiment-cluster \
  --service-name sentiment-api \
  --task-definition sentiment-api \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxx],securityGroups=[sg-xxxx],assignPublicIp=ENABLED}" \
  --region us-east-1
```

### Estimated cost on AWS Fargate

| Resource | Monthly cost |
|----------|-------------|
| 2 vCPU + 4 GB RAM (always on) | ~$55–65 |
| EFS storage (5 GB for model cache) | ~$1.50 |
| Data transfer | ~$1–5 |
| **Total** | **~$58–72/month** |

> Fargate has no free tier and no scale-to-zero. It is the most expensive option for low-traffic workloads. Only choose it if you need AWS-native integrations (IAM, VPC, CloudWatch).

---

## 7. Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_MODEL` | `FacebookAI/xlm-roberta-base` | HuggingFace model ID for base weights |
| `MODEL_DIR` | `./model` | Path to the LoRA adapter directory inside the container |
| `MAX_LENGTH` | `128` | Tokeniser max sequence length — must match training |
| `PORT` | `8000` | Uvicorn listen port |
| `WORKERS` | `1` | Uvicorn worker count — keep at 1 (model is loaded once per process) |
| `HF_HOME` | `/app/.cache/huggingface` | HuggingFace cache directory — mount a volume here |

---

## 8. Post-Deployment Checklist

After deploying to any platform, verify the following:

```bash
BASE_URL=https://your-deployed-url.com

# 1. Health check
curl $BASE_URL/health
# Expected: {"status":"ok","model_loaded":true}

# 2. Arabic input
curl -X POST $BASE_URL/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "هذا المنتج رائع جداً وأنصح به"}'

# 3. English input
curl -X POST $BASE_URL/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "Terrible experience, would not recommend"}'

# 4. Mixed input
curl -X POST $BASE_URL/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "المنتج كان amazing جداً"}'

# 5. Batch endpoint
curl -X POST $BASE_URL/predict/batch \
  -H "Content-Type: application/json" \
  -d '{"texts": ["great product", "سيء جداً", "it was okay"]}'

# 6. Swagger UI
open $BASE_URL/docs
```

All five checks must pass before considering the deployment successful.

---

## 9. Cost Optimisation Tips

1. **Always mount a persistent volume for `HF_HOME`.** Without it, the container downloads ~1.1 GB on every cold start, which is slow and incurs egress costs.

2. **Use `--min-instances 0` on Cloud Run** unless you need sub-second response times. Scale-to-zero eliminates idle costs entirely.

3. **Keep `WORKERS=1`.** The model is loaded into memory once per worker process. Two workers = 2× RAM usage (~4 GB). On CPU-only instances, a single worker is already the bottleneck.

4. **Use `concurrency=1` on Cloud Run.** The model is not thread-safe for parallel inference without additional locking. One request per instance prevents subtle prediction errors under load.

5. **Cache the Docker image layers.** Use a container registry (GCR, ECR, Docker Hub) so the base Python image and pip dependencies are not re-downloaded on every build.

6. **Pre-warm with a dummy request.** After a cold start, send one request to `/health` before routing real traffic. This ensures the model is fully loaded and JIT-compiled.
