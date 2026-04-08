FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./

RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY api_service.py ./api_service.py
COPY pipeline.py ./pipeline.py
COPY localization.py ./localization.py
COPY .env ./.env

EXPOSE 8020

CMD ["sh", "-c", "uvicorn api_service:app --host 0.0.0.0 --port 8020"]
