"""Шифрование персональных данных при хранении (152-ФЗ ст. 19, приказ ФСТЭК № 117).

Всё, где лежат ПДн сотрудников и контактов вузов, в базе и на диске хранится только в виде шифротекста:
снимок данных CRM, копии коллекций в истории импортов, тексты очереди Telegram и загруженные файлы.
Дамп PostgreSQL или копия тома с вложениями без ключа бесполезны.

* Алгоритм — AES-256-GCM (NIST SP 800-38D): шифрование и контроль целостности одной операцией.
  Подмена или порча шифротекста обнаруживается при чтении и заканчивается ошибкой, а не мусором в данных.
* AAD (дополнительные аутентифицируемые данные) — имя поля, например ``state_snapshots.state``:
  шифротекст нельзя незаметно переставить из одного поля в другое.
* У каждого ключа есть идентификатор. Новые записи шифруются первым ключом из ``DATA_ENCRYPTION_KEYS``,
  прочие ключи нужны только для чтения — так ключ меняют без остановки (см. scripts/encrypt_existing_data.py).
* Данные, записанные до включения шифрования, читаются как есть и шифруются при следующей записи
  или скриптом миграции.
* Файлы шифруются потоком, блоками по 1 МБ (схема STREAM): у каждого блока свой nonce из общего
  префикса и номера, а последний блок помечен в AAD — обрезать файл или переставить блоки незаметно нельзя.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import secrets
import zlib
from collections.abc import Iterator
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, BinaryIO

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import JSON, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator

from app.core.config import settings


logger = logging.getLogger(__name__)

KEY_BYTES = 32  # AES-256
NONCE_BYTES = 12
TAG_BYTES = 16
ENVELOPE_MARK = "$enc"
ENVELOPE_VERSION = "aes256gcm-zlib-v1"
TEXT_PREFIX = "enc:v1:"
FILE_MAGIC = b"RTKENC1\n"
FILE_CHUNK_BYTES = 1024 * 1024
FILE_NONCE_PREFIX_BYTES = 8


class DecryptionError(RuntimeError):
    """Шифротекст повреждён, подменён или зашифрован неизвестным ключом."""


def generate_key_entry(key_id: str | None = None) -> str:
    """Новая запись для DATA_ENCRYPTION_KEYS: «id:ключ-base64url»."""

    key_id = key_id or f"k{datetime.now(UTC):%Y%m%d%H%M%S}"
    return f"{key_id}:{base64.urlsafe_b64encode(secrets.token_bytes(KEY_BYTES)).decode().rstrip('=')}"


def _parse_keys(raw: str) -> dict[str, bytes]:
    keys: dict[str, bytes] = {}
    for entry in (part.strip() for part in raw.split(",")):
        if not entry:
            continue
        key_id, separator, encoded = entry.partition(":")
        if not separator or not key_id or len(key_id.encode()) > 64:
            raise ValueError("DATA_ENCRYPTION_KEYS: ожидается «id:ключ-base64url» через запятую")
        key = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
        if len(key) != KEY_BYTES:
            raise ValueError(f"DATA_ENCRYPTION_KEYS: ключ «{key_id}» должен быть длиной {KEY_BYTES} байта")
        keys[key_id] = key
    if not keys:
        raise ValueError("DATA_ENCRYPTION_KEYS пуст")
    return keys


def _local_key_file(path: Path) -> str:
    """Ключ локального стенда: создаётся один раз с правами 0600 рядом с данными (каталог не в git)."""

    if path.is_file():
        return path.read_text(encoding="utf-8").strip()
    path.parent.mkdir(parents=True, exist_ok=True)
    entry = generate_key_entry()
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:  # Другой процесс успел создать ключ первым.
        return path.read_text(encoding="utf-8").strip()
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        stream.write(entry + "\n")
    logger.warning("Создан локальный ключ шифрования %s — в production задайте DATA_ENCRYPTION_KEYS", path)
    return entry


class Keyring:
    def __init__(self, raw_keys: str) -> None:
        self._keys = _parse_keys(raw_keys)
        self.primary_id = next(iter(self._keys))
        self._ciphers = {key_id: AESGCM(key) for key_id, key in self._keys.items()}

    def _cipher(self, key_id: str) -> AESGCM:
        cipher = self._ciphers.get(key_id)
        if cipher is None:
            raise DecryptionError(f"Нет ключа «{key_id}» в DATA_ENCRYPTION_KEYS")
        return cipher

    # --- байты: nonce ‖ шифротекст ‖ тег, идентификатор ключа хранится рядом ---

    def encrypt(self, plaintext: bytes, aad: str) -> tuple[str, bytes]:
        nonce = secrets.token_bytes(NONCE_BYTES)
        return self.primary_id, nonce + self._cipher(self.primary_id).encrypt(nonce, plaintext, aad.encode())

    def decrypt(self, key_id: str, blob: bytes, aad: str) -> bytes:
        try:
            return self._cipher(key_id).decrypt(blob[:NONCE_BYTES], blob[NONCE_BYTES:], aad.encode())
        except InvalidTag as exc:
            raise DecryptionError(f"Шифротекст поля {aad} повреждён или подменён") from exc

    # --- JSON-поля: {"$enc": версия, "kid": ключ, "data": base64(nonce ‖ zlib(JSON) зашифрованный)} ---

    def encrypt_json(self, value: Any, aad: str) -> dict[str, str]:
        # Сжатие до шифрования: снимок CRM — мегабайты повторяющегося JSON, после zlib он в разы меньше.
        packed = zlib.compress(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode(), 1)
        key_id, blob = self.encrypt(packed, aad)
        return {ENVELOPE_MARK: ENVELOPE_VERSION, "kid": key_id, "data": base64.b64encode(blob).decode()}

    def decrypt_json(self, value: Any, aad: str) -> Any:
        if not is_encrypted_json(value):
            return value  # Записано до включения шифрования.
        if value[ENVELOPE_MARK] != ENVELOPE_VERSION:
            raise DecryptionError(f"Неизвестная версия шифрования поля {aad}")
        packed = self.decrypt(value["kid"], base64.b64decode(value["data"]), aad)
        return json.loads(zlib.decompress(packed))

    # --- текстовые поля: "enc:v1:<kid>:<base64>" ---

    def encrypt_text(self, value: str, aad: str) -> str:
        key_id, blob = self.encrypt(value.encode(), aad)
        return f"{TEXT_PREFIX}{key_id}:{base64.b64encode(blob).decode()}"

    def decrypt_text(self, value: str, aad: str) -> str:
        if not is_encrypted_text(value):
            return value
        key_id, _, encoded = value.removeprefix(TEXT_PREFIX).partition(":")
        return self.decrypt(key_id, base64.b64decode(encoded), aad).decode()

    # --- файлы: FILE_MAGIC ‖ len(kid) ‖ kid ‖ префикс nonce ‖ блоки (≤ 1 МБ + тег) ---

    def encrypt_stream(self, chunks: Iterator[bytes], output: BinaryIO, aad: str) -> None:
        """chunks — блоки открытого текста любого размера; пишет зашифрованный файл в output."""

        cipher = self._cipher(self.primary_id)
        prefix = secrets.token_bytes(FILE_NONCE_PREFIX_BYTES)
        key_id = self.primary_id.encode()
        output.write(FILE_MAGIC + bytes([len(key_id)]) + key_id + prefix)
        buffer = b""
        counter = 0
        for chunk in chunks:
            buffer += chunk
            while len(buffer) > FILE_CHUNK_BYTES:  # Строго больше: последний блок остаётся до конца потока.
                output.write(cipher.encrypt(_file_nonce(prefix, counter), buffer[:FILE_CHUNK_BYTES], _file_aad(aad, counter, final=False)))
                buffer = buffer[FILE_CHUNK_BYTES:]
                counter += 1
        output.write(cipher.encrypt(_file_nonce(prefix, counter), buffer, _file_aad(aad, counter, final=True)))

    def decrypt_stream(self, source: BinaryIO, aad: str) -> Iterator[bytes]:
        header = source.read(len(FILE_MAGIC) + 1)
        if header[: len(FILE_MAGIC)] != FILE_MAGIC:
            raise DecryptionError("Файл не зашифрован")
        key_id = source.read(header[-1]).decode()
        cipher = self._cipher(key_id)
        prefix = source.read(FILE_NONCE_PREFIX_BYTES)
        counter = 0
        block = source.read(FILE_CHUNK_BYTES + TAG_BYTES)
        while True:
            following = source.read(FILE_CHUNK_BYTES + TAG_BYTES)
            final = not following
            try:
                yield cipher.decrypt(_file_nonce(prefix, counter), block, _file_aad(aad, counter, final=final))
            except InvalidTag as exc:
                raise DecryptionError(f"Файл {aad} повреждён или подменён") from exc
            if final:
                return
            block = following
            counter += 1


def _file_nonce(prefix: bytes, counter: int) -> bytes:
    return prefix + counter.to_bytes(NONCE_BYTES - FILE_NONCE_PREFIX_BYTES, "big")


def _file_aad(aad: str, counter: int, *, final: bool) -> bytes:
    return f"{aad}|{counter}|{'final' if final else 'more'}".encode()


def is_encrypted_json(value: Any) -> bool:
    return isinstance(value, dict) and ENVELOPE_MARK in value and "data" in value


def is_encrypted_text(value: Any) -> bool:
    return isinstance(value, str) and value.startswith(TEXT_PREFIX)


def is_encrypted_file(path: Path) -> bool:
    with path.open("rb") as stream:
        return stream.read(len(FILE_MAGIC)) == FILE_MAGIC


@lru_cache
def get_keyring() -> Keyring:
    if settings.data_encryption_keys:
        return Keyring(settings.data_encryption_keys)
    if settings.is_production:
        # Без явного ключа production не стартует: иначе ПДн молча легли бы на диск открытым текстом
        # или ключ оказался бы в том же томе, что и данные. deploy/deploy.sh создаёт ключ сам.
        raise RuntimeError("DATA_ENCRYPTION_KEYS не задан: в production персональные данные хранятся только зашифрованными")
    return Keyring(_local_key_file(settings.data_encryption_key_path))


class EncryptedJSON(TypeDecorator):
    """JSON-колонка, которая в базе хранит только конверт с шифротекстом."""

    impl = JSON
    cache_ok = True

    def __init__(self, aad: str) -> None:
        super().__init__()
        self.aad = aad

    def load_dialect_impl(self, dialect: Any) -> Any:
        # Тип колонки в базе прежний (JSONB / JSON), поэтому миграция схемы не нужна.
        return dialect.type_descriptor(JSONB(none_as_null=False) if dialect.name == "postgresql" else JSON())

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        # Шифруется всё, даже то, что похоже на конверт: иначе «готовый конверт» лёг бы в базу как есть.
        return None if value is None else get_keyring().encrypt_json(value, self.aad)

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        return get_keyring().decrypt_json(value, self.aad)


class EncryptedText(TypeDecorator):
    impl = Text
    cache_ok = True

    def __init__(self, aad: str) -> None:
        super().__init__()
        self.aad = aad

    def process_bind_param(self, value: str | None, dialect: Any) -> str | None:
        return None if value is None else get_keyring().encrypt_text(value, self.aad)

    def process_result_value(self, value: str | None, dialect: Any) -> str | None:
        return None if value is None else get_keyring().decrypt_text(value, self.aad)
