"""Загрузка файлов к этапам и их скачивание (только с токеном)."""

from __future__ import annotations

from fastapi import APIRouter, File, UploadFile
from urllib.parse import quote

from fastapi.responses import StreamingResponse

from app.api.dependencies import CurrentPrincipal, DbSession
from app.schemas.attachment import AttachmentResponse
from app.schemas.common import ERROR_RESPONSES
from app.services.attachment import get_attachment, read_attachment, save_attachment


router = APIRouter(prefix="/attachments", tags=["attachments"])


@router.post(
    "",
    response_model=AttachmentResponse,
    status_code=201,
    responses=ERROR_RESPONSES,
    summary="Загрузить файл к этапу взаимодействия",
)
async def upload_attachment(
    db: DbSession,
    principal: CurrentPrincipal,
    file: UploadFile = File(...),
) -> AttachmentResponse:
    return await save_attachment(db, file, uploaded_by=principal.subject)


@router.get(
    "/{attachment_id}",
    responses={401: ERROR_RESPONSES[401], 404: {"description": "File not found."}},
    summary="Скачать ранее загруженный файл",
)
def download_attachment(
    attachment_id: str,
    db: DbSession,
    _: CurrentPrincipal,
) -> StreamingResponse:
    model, path = get_attachment(db, attachment_id)
    # Файл на диске зашифрован — отдаём расшифрованный поток; размер известен из базы.
    return StreamingResponse(
        read_attachment(model, path),
        media_type=model.content_type or "application/octet-stream",
        headers={
            "Cache-Control": "private, no-store",
            "Content-Length": str(model.size),
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(model.original_name)}",
        },
    )
