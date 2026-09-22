"""Upload and authenticated download endpoints for workflow attachments."""

from __future__ import annotations

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import FileResponse

from app.api.dependencies import CurrentPrincipal, DbSession
from app.schemas.attachment import AttachmentResponse
from app.schemas.common import ERROR_RESPONSES
from app.services.attachment import get_attachment, save_attachment


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
) -> FileResponse:
    model, path = get_attachment(db, attachment_id)
    return FileResponse(
        path,
        media_type=model.content_type or "application/octet-stream",
        filename=model.original_name,
        headers={"Cache-Control": "private, no-store"},
    )
