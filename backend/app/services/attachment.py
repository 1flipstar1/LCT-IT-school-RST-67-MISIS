"""Validated local attachment storage.

Only opaque generated names are used on disk. Original names stay in the
database and are supplied solely through Content-Disposition on download.
Files are encrypted on disk (AES-256-GCM, app/core/crypto.py): договоры и протоколы содержат ПДн.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.crypto import get_keyring, is_encrypted_file
from app.core.errors import APIError
from app.models.attachment import AttachmentModel
from app.schemas.attachment import AttachmentResponse


ALLOWED_EXTENSIONS = {
    "png", "jpg", "jpeg", "pdf", "zip", "gz", "gzip", "rar", "doc", "docx", "xls", "xlsx", "csv"
}
CHUNK_SIZE = 1024 * 1024


def _response(model: AttachmentModel) -> AttachmentResponse:
    return AttachmentResponse(
        id=model.id,
        name=model.original_name,
        size=model.size,
        content_type=model.content_type,
        download_url=f"{settings.api_v1_prefix}/attachments/{model.id}",
        created_at=model.created_at,
    )


async def save_attachment(db: Session, upload: UploadFile, *, uploaded_by: str) -> AttachmentResponse:
    original_name = Path(upload.filename or "").name.strip()
    extension = Path(original_name).suffix.lower().lstrip(".")
    if not original_name or extension not in ALLOWED_EXTENSIONS:
        raise APIError(
            415,
            "file_type_not_supported",
            "Формат файла не поддерживается.",
            {"fileName": original_name, "allowedExtensions": sorted(ALLOWED_EXTENSIONS)},
        )

    attachment_id = str(uuid4())
    stored_name = f"{attachment_id}.{extension}"
    storage = settings.attachment_storage_path
    storage.mkdir(parents=True, exist_ok=True)
    final_path = storage / stored_name
    temporary_path = storage / f".{stored_name}.part"
    size = 0

    try:
        # Открытый текст не касается диска: сначала файл читается целиком в память (до 25 МБ),
        # затем пишется сразу зашифрованным.
        chunks: list[bytes] = []
        while chunk := await upload.read(CHUNK_SIZE):
            size += len(chunk)
            if size > settings.max_attachment_bytes:
                raise APIError(
                    413,
                    "file_too_large",
                    "Файл превышает допустимый размер.",
                    {"fileName": original_name, "maxBytes": settings.max_attachment_bytes},
                )
            chunks.append(chunk)
        with temporary_path.open("xb") as stream:
            get_keyring().encrypt_stream(iter(chunks), stream, attachment_aad(attachment_id))
        os.replace(temporary_path, final_path)
    except Exception:
        temporary_path.unlink(missing_ok=True)
        final_path.unlink(missing_ok=True)
        raise
    finally:
        await upload.close()

    model = AttachmentModel(
        id=attachment_id,
        original_name=original_name,
        stored_name=stored_name,
        content_type=upload.content_type,
        size=size,
        uploaded_by=uploaded_by,
    )
    db.add(model)
    try:
        db.commit()
        db.refresh(model)
    except Exception:
        db.rollback()
        final_path.unlink(missing_ok=True)
        raise
    return _response(model)


def get_attachment(db: Session, attachment_id: str) -> tuple[AttachmentModel, Path]:
    model = db.get(AttachmentModel, attachment_id)
    if model is None:
        raise APIError(404, "attachment_not_found", "Файл не найден.")
    path = settings.attachment_storage_path / model.stored_name
    if not path.is_file():
        raise APIError(410, "attachment_missing", "Файл отсутствует в хранилище.")
    return model, path


def attachment_aad(attachment_id: str) -> str:
    """Шифротекст привязан к id вложения: подложить под один id файл другого не получится."""

    return f"attachments.{attachment_id}"


def read_attachment(model: AttachmentModel, path: Path) -> Iterator[bytes]:
    """Открытое содержимое файла блоками; файлы, загруженные до включения шифрования, отдаются как есть."""

    with path.open("rb") as stream:
        if is_encrypted_file(path):
            yield from get_keyring().decrypt_stream(stream, attachment_aad(model.id))
            return
        while chunk := stream.read(CHUNK_SIZE):
            yield chunk
