#!/bin/sh
set -e

echo "[Crm-One-step Backend] Running Alembic database migrations (alembic upgrade head)..."
alembic upgrade head

echo "[Crm-One-step Backend] Starting FastAPI Uvicorn server on 0.0.0.0:8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers
