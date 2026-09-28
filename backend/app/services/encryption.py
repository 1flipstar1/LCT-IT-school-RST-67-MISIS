"""Шифрование данных, записанных до включения шифрования, и перешифрование при смене ключа.

Запускается одним процессом перед стартом API (Dockerfile, run-local.sh): ``python -m app.services.encryption``.
Идемпотентно — повторный запуск ничего не меняет. Переписывает только то, что лежит открытым текстом
или зашифровано не основным ключом (первым в DATA_ENCRYPTION_KEYS), поэтому после ротации ключа
достаточно перезапуска: старый ключ можно убрать из списка, когда скрипт отчитается «0».
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from sqlalchemy import JSON, Text, column, select, table, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.crypto import (
    FILE_MAGIC,
    TEXT_PREFIX,
    EncryptedJSON,
    EncryptedText,
    get_keyring,
    is_encrypted_json,
    is_encrypted_text,
)
from app.core.database import SessionLocal, create_database_schema
from app.models.attachment import AttachmentModel
from app.services.attachment import CHUNK_SIZE, attachment_aad, read_attachment


logger = logging.getLogger(__name__)

# (таблица, ключевая колонка, колонка) — всё, где лежат персональные данные.
JSON_COLUMNS = [
    ("state_snapshots", "id", "state"),
    ("import_jobs", "id", "issues"),
    ("import_jobs", "id", "snapshot_before"),
]
TEXT_COLUMNS = [("telegram_deliveries", "id", "text")]


def _raw_json(value: Any) -> Any:
    return json.loads(value) if isinstance(value, str) else value


def _json_needs_rewrite(value: Any) -> bool:
    return not is_encrypted_json(value) or value.get("kid") != get_keyring().primary_id


def _text_needs_rewrite(value: str) -> bool:
    if not is_encrypted_text(value):
        return True
    return value.removeprefix(TEXT_PREFIX).partition(":")[0] != get_keyring().primary_id


def _file_key_id(path: os.PathLike[str]) -> str | None:
    with open(path, "rb") as stream:
        if stream.read(len(FILE_MAGIC)) != FILE_MAGIC:
            return None
        return stream.read(stream.read(1)[0]).decode()


def _migrate_json(db: Session, table_name: str, key: str, name: str) -> int:
    # Сырые значения: колонка объявлена обычным JSON, без расшифровки.
    raw = table(table_name, column(key), column(name, JSON))
    typed = table(table_name, column(key), column(name, EncryptedJSON(f"{table_name}.{name}")))
    changed = 0
    # FOR UPDATE: бот в соседнем контейнере может сохранять снимок в ту же секунду.
    for row_key, value in db.execute(select(raw.c[key], raw.c[name]).with_for_update()).all():
        value = _raw_json(value)
        if value is None or not _json_needs_rewrite(value):
            continue
        plain = get_keyring().decrypt_json(value, f"{table_name}.{name}")
        db.execute(update(typed).where(typed.c[key] == row_key).values({name: plain}))
        changed += 1
    return changed


def _migrate_text(db: Session, table_name: str, key: str, name: str) -> int:
    raw = table(table_name, column(key), column(name, Text))
    typed = table(table_name, column(key), column(name, EncryptedText(f"{table_name}.{name}")))
    changed = 0
    for row_key, value in db.execute(select(raw.c[key], raw.c[name]).with_for_update()).all():
        if value is None or not _text_needs_rewrite(value):
            continue
        plain = get_keyring().decrypt_text(value, f"{table_name}.{name}")
        db.execute(update(typed).where(typed.c[key] == row_key).values({name: plain}))
        changed += 1
    return changed


def _migrate_attachments(db: Session) -> int:
    changed = 0
    for model in db.scalars(select(AttachmentModel)):
        path = settings.attachment_storage_path / model.stored_name
        if not path.is_file() or _file_key_id(path) == get_keyring().primary_id:
            continue
        temporary = path.with_name(f".{path.name}.reencrypt")
        # read_attachment отдаёт открытый текст и для старых незашифрованных файлов, и для старого ключа.
        plaintext = b"".join(read_attachment(model, path))
        with temporary.open("wb") as stream:
            get_keyring().encrypt_stream(
                (plaintext[offset : offset + CHUNK_SIZE] for offset in range(0, max(len(plaintext), 1), CHUNK_SIZE)),
                stream,
                attachment_aad(model.id),
            )
        os.replace(temporary, path)
        changed += 1
    return changed


def encrypt_existing_data(db: Session) -> dict[str, int]:
    report: dict[str, int] = {}
    for table_name, key, name in JSON_COLUMNS:
        report[f"{table_name}.{name}"] = _migrate_json(db, table_name, key, name)
    for table_name, key, name in TEXT_COLUMNS:
        report[f"{table_name}.{name}"] = _migrate_text(db, table_name, key, name)
    db.commit()
    report["attachments"] = _migrate_attachments(db)
    return report


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    create_database_schema()
    keyring = get_keyring()
    with SessionLocal() as db:
        report = encrypt_existing_data(db)
    logger.info("Шифрование ПДн: основной ключ %s, переписано %s", keyring.primary_id, report)


if __name__ == "__main__":
    main()
