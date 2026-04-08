import os
import re
import time
import logging
from typing import Dict

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from peft import PeftModel

logger = logging.getLogger(__name__)

BASE_MODEL = os.getenv("BASE_MODEL", "FacebookAI/xlm-roberta-base")
MODEL_DIR = os.getenv("MODEL_DIR", "./model")
MAX_LENGTH = int(os.getenv("MAX_LENGTH", "128"))

ID2LABEL = {0: "NEGATIVE", 1: "NEUTRAL", 2: "POSITIVE"}

_tokenizer = None
_model = None
_device = None


def preprocess_text(text: str) -> str:
    if not isinstance(text, str) or text.strip() == "":
        return ""

    text = re.sub(r"http\S+|www\.\S+", "", text)
    text = re.sub(r"\S+@\S+", "", text)

    text = re.sub(r"[إأآٱ]", "ا", text)
    text = re.sub(r"ى", "ي", text)
    text = re.sub(r"ة", "ه", text)

    text = re.sub(r"[\u0617-\u061A\u064B-\u0652]", "", text)

    text = re.sub(r"[^\w\s\u0600-\u06FF\u0750-\u077F!?.,،؟]", " ", text)

    text = re.sub(r"\s+", " ", text).strip()

    return text


def load_model():
    global _tokenizer, _model, _device

    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info("Loading tokenizer from %s", BASE_MODEL)

    _tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)

    logger.info("Loading base model %s", BASE_MODEL)
    base = AutoModelForSequenceClassification.from_pretrained(
        BASE_MODEL,
        num_labels=3,
        id2label=ID2LABEL,
        label2id={v: k for k, v in ID2LABEL.items()},
    )

    logger.info("Loading LoRA adapter from %s", MODEL_DIR)
    _model = PeftModel.from_pretrained(base, MODEL_DIR)
    _model = _model.to(_device)
    _model.eval()

    logger.info("Model ready on %s", _device)


def is_model_loaded() -> bool:
    return _model is not None and _tokenizer is not None


def predict(text: str) -> Dict:
    start = time.perf_counter()

    clean = preprocess_text(text)
    if not clean:
        return {
            "label": "NEUTRAL",
            "confidence": 0.0,
            "scores": {"NEGATIVE": 0.0, "NEUTRAL": 0.0, "POSITIVE": 0.0},
            "processing_time_ms": 0.0,
        }

    encoding = _tokenizer(
        clean,
        add_special_tokens=True,
        max_length=MAX_LENGTH,
        truncation=True,
        padding="max_length",
        return_attention_mask=True,
        return_tensors="pt",
    )

    input_ids = encoding["input_ids"].to(_device)
    attention_mask = encoding["attention_mask"].to(_device)

    with torch.no_grad():
        outputs = _model(input_ids=input_ids, attention_mask=attention_mask)
        probs = torch.softmax(outputs.logits, dim=-1)[0]

    scores = {ID2LABEL[i]: round(probs[i].item(), 4) for i in range(3)}
    pred_idx = int(probs.argmax().item())
    label = ID2LABEL[pred_idx]
    confidence = round(probs[pred_idx].item(), 4)

    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

    return {
        "label": label,
        "confidence": confidence,
        "scores": scores,
        "processing_time_ms": elapsed_ms,
    }


def predict_batch(texts: list[str]) -> list[Dict]:
    start = time.perf_counter()

    cleaned = [preprocess_text(t) for t in texts]

    encoding = _tokenizer(
        cleaned,
        add_special_tokens=True,
        max_length=MAX_LENGTH,
        truncation=True,
        padding="max_length",
        return_attention_mask=True,
        return_tensors="pt",
    )

    input_ids = encoding["input_ids"].to(_device)
    attention_mask = encoding["attention_mask"].to(_device)

    with torch.no_grad():
        outputs = _model(input_ids=input_ids, attention_mask=attention_mask)
        probs = torch.softmax(outputs.logits, dim=-1)

    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
    per_item_ms = round(elapsed_ms / max(len(texts), 1), 2)

    results = []
    for i, (text, prob_row) in enumerate(zip(texts, probs)):
        if not cleaned[i]:
            results.append({
                "label": "NEUTRAL",
                "confidence": 0.0,
                "scores": {"NEGATIVE": 0.0, "NEUTRAL": 0.0, "POSITIVE": 0.0},
                "processing_time_ms": 0.0,
            })
            continue

        scores = {ID2LABEL[j]: round(prob_row[j].item(), 4) for j in range(3)}
        pred_idx = int(prob_row.argmax().item())
        label = ID2LABEL[pred_idx]
        confidence = round(prob_row[pred_idx].item(), 4)

        results.append({
            "label": label,
            "confidence": confidence,
            "scores": scores,
            "processing_time_ms": per_item_ms,
        })

    return results
