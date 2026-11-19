from __future__ import annotations

import csv
import io
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status

from app.core.security import TokenPayload, get_current_token_payload
from app.schemas.crm import CsvImportJobResponse
from app.worker import CSV_IMPORT_JOB_RESULTS, process_large_csv_import_task

router = APIRouter(tags=["Background Bulk CSV Import (ARQ + Redis)"])


@router.post(
    "/import/csv",
    response_model=CsvImportJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def import_large_csv_in_background(
    request: Request,
    file: Optional[UploadFile] = File(default=None),
    default_source: str = Form(default="استيراد CSV"),
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> CsvImportJobResponse:
    """
    Background CSV Import endpoint (`POST /api/v1/import/csv`):
      - Accepts a multipart CSV file upload (or JSON `{ "rows": [...] }` body).
      - Parses rows and dispatches `process_large_csv_import_task` to the ARQ Redis
        worker for batch processing with deduplication (`lead_uid`, `email`, `phone`)
        and automatic `RWQ-xxxxx` + `Touchpoint` creation.
      - Falls back to immediate async batch execution if Redis is offline in dev.
    """
    parsed_rows: List[Dict[str, Any]] = []

    if file is not None:
        raw_bytes = await file.read()
        try:
            text_content = raw_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            text_content = raw_bytes.decode("cp1256", errors="replace")

        reader = csv.DictReader(io.StringIO(text_content))
        for row in reader:
            cleaned = {str(k).strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items() if k}
            if any(cleaned.values()):
                parsed_rows.append(cleaned)
    else:
        try:
            body_json = await request.json()
            raw_list = body_json.get("rows") or body_json.get("leads") or []
            if isinstance(raw_list, list):
                parsed_rows = [dict(item) for item in raw_list if isinstance(item, dict)]
        except Exception:
            parsed_rows = []

    if not parsed_rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ملف CSV فارغ أو لا يحتوي على صفوف صالحة للاستيراد.",
        )

    job_id = f"csv_import_{uuid.uuid4().hex[:12]}"
    arq_pool = getattr(request.app.state, "arq_pool", None)

    if arq_pool is not None:
        try:
            await arq_pool.enqueue_job(
                "process_large_csv_import_task",
                _job_id=job_id,
                job_id=job_id,
                org_id=str(token_payload.org_id),
                rows=parsed_rows,
                default_source=default_source,
            )
            CSV_IMPORT_JOB_RESULTS[job_id] = {
                "job_id": job_id,
                "status": "queued",
                "org_id": str(token_payload.org_id),
                "total_rows": len(parsed_rows),
                "imported_count": 0,
                "skipped_duplicates": 0,
                "errors": [],
            }
            return CsvImportJobResponse(
                job_id=job_id,
                status="queued",
                org_id=token_payload.org_id,
                total_rows=len(parsed_rows),
                queued_via_arq=True,
            )
        except Exception:
            pass

    # Fallback direct async execution if Redis is offline
    result = await process_large_csv_import_task(
        {},
        job_id=job_id,
        org_id=str(token_payload.org_id),
        rows=parsed_rows,
        default_source=default_source,
    )
    return CsvImportJobResponse(
        job_id=job_id,
        status=result["status"],
        org_id=token_payload.org_id,
        total_rows=result["total_rows"],
        imported_count=result["imported_count"],
        skipped_duplicates=result["skipped_duplicates"],
        errors=result["errors"],
        queued_via_arq=False,
    )


@router.get("/import/status/{job_id}", response_model=CsvImportJobResponse)
async def get_csv_import_job_status(
    job_id: str,
    token_payload: TokenPayload = Depends(get_current_token_payload),
) -> CsvImportJobResponse:
    cached = CSV_IMPORT_JOB_RESULTS.get(job_id)
    if not cached:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="مهمة الاستيراد غير موجودة.",
        )
    return CsvImportJobResponse(
        job_id=job_id,
        status=cached["status"],
        org_id=token_payload.org_id,
        total_rows=cached["total_rows"],
        imported_count=cached["imported_count"],
        skipped_duplicates=cached["skipped_duplicates"],
        errors=cached["errors"],
        queued_via_arq=True,
    )
