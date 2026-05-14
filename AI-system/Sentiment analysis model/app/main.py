import logging
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.model import load_model, is_model_loaded, predict, predict_batch

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading sentiment model...")
    load_model()
    logger.info("Model loaded successfully.")
    yield


app = FastAPI(
    title="Bilingual Sentiment Analysis API",
    description="Arabic + English sentiment analysis using XLM-RoBERTa + LoRA. Returns NEGATIVE / NEUTRAL / POSITIVE.",
    version="1.0.0",
    lifespan=lifespan,
)


class PredictRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Input text (Arabic, English, or mixed)")


class PredictBatchRequest(BaseModel):
    texts: List[str] = Field(..., min_items=1, max_items=64, description="Up to 64 texts")


class SentimentResult(BaseModel):
    label: str
    confidence: float
    scores: dict
    processing_time_ms: float


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": is_model_loaded()}


@app.post("/predict", response_model=SentimentResult)
def predict_single(request: PredictRequest):
    if not is_model_loaded():
        raise HTTPException(status_code=503, detail="Model not loaded yet")
    return predict(request.text)


@app.post("/predict/batch", response_model=List[SentimentResult])
def predict_batch_endpoint(request: PredictBatchRequest):
    if not is_model_loaded():
        raise HTTPException(status_code=503, detail="Model not loaded yet")
    return predict_batch(request.texts)
