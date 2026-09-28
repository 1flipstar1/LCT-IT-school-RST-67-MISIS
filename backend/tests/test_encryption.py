import base64
import io
import json
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.core import crypto
from app.core.config import settings
from app.core.crypto import FILE_CHUNK_BYTES, DecryptionError, Keyring, generate_key_entry
from app.core.database import SessionLocal
from app.services.encryption import encrypt_existing_data
from tests.conftest import TEST_ATTACHMENTS, TEST_DATABASE

OLD_FIRST = "test-old:" + "B" * 43 + ",test-new:" + "A" * 43


def _raw(sql: str) -> list[tuple]:
    with sqlite3.connect(TEST_DATABASE) as connection:
        return connection.execute(sql).fetchall()


@pytest.fixture()
def primary_key(monkeypatch: pytest.MonkeyPatch):
    """Переключает основной ключ шифрования на время теста."""

    def switch(keys: str) -> None:
        monkeypatch.setattr(settings, "data_encryption_keys", keys)
        crypto.get_keyring.cache_clear()

    yield switch
    crypto.get_keyring.cache_clear()


def test_keyring_round_trip_and_tamper_detection() -> None:
    keyring = Keyring(generate_key_entry("a"))
    value = {"users": [{"name": "Алина Воронова", "email": "a.voronova@rt.ru"}]}
    envelope = keyring.encrypt_json(value, "state_snapshots.state")
    assert "Воронова" not in json.dumps(envelope, ensure_ascii=False)
    assert keyring.decrypt_json(envelope, "state_snapshots.state") == value

    with pytest.raises(DecryptionError):  # Шифротекст привязан к полю.
        keyring.decrypt_json(envelope, "import_jobs.issues")
    blob = bytearray(base64.b64decode(envelope["data"]))
    blob[-1] ^= 1  # Один изменённый бит — и тег GCM не сходится.
    with pytest.raises(DecryptionError):
        keyring.decrypt_json({**envelope, "data": base64.b64encode(blob).decode()}, "state_snapshots.state")
    with pytest.raises(DecryptionError):  # Чужой ключ.
        Keyring(generate_key_entry("a")).decrypt_json(envelope, "state_snapshots.state")

    text = keyring.encrypt_text("Созвонились с Ириной, +7 900 000-00-00", "telegram_deliveries.text")
    assert "Ирин" not in text and keyring.decrypt_text(text, "telegram_deliveries.text").startswith("Созвонились")
    assert keyring.decrypt_json({"plain": True}, "x") == {"plain": True}  # Старые открытые данные читаются.


@pytest.mark.parametrize("size", [0, 1, FILE_CHUNK_BYTES, FILE_CHUNK_BYTES + 1, 3 * FILE_CHUNK_BYTES - 7])
def test_file_stream_round_trip(size: int) -> None:
    keyring = Keyring(generate_key_entry("f"))
    data = bytes(index % 251 for index in range(size))
    encrypted = io.BytesIO()
    keyring.encrypt_stream(iter([data[:100], data[100:]]), encrypted, "attachments.1")
    assert b"".join(keyring.decrypt_stream(io.BytesIO(encrypted.getvalue()), "attachments.1")) == data

    if size > FILE_CHUNK_BYTES:  # Обрезанный файл не выдать за целый: последний блок помечен.
        truncated = encrypted.getvalue()[: -(size % FILE_CHUNK_BYTES or FILE_CHUNK_BYTES) - 16]
        with pytest.raises(DecryptionError):
            b"".join(keyring.decrypt_stream(io.BytesIO(truncated), "attachments.1"))


def test_database_and_disk_hold_only_ciphertext(client: TestClient, admin_headers: dict[str, str]) -> None:
    assert client.post("/api/v1/state/reset", headers=admin_headers, json={}).status_code == 200
    stored = _raw("SELECT state FROM state_snapshots")[0][0]
    assert "$enc" in stored and "a.voronova@rt.ru" not in stored and "Воронова" not in stored
    assert client.get("/api/v1/state", headers=admin_headers).json()["state"]["users"][0]["email"] == "a.voronova@rt.ru"

    content = "Договор с вузом, контакт: Ирина, i.ivanova@example.ru".encode()
    uploaded = client.post("/api/v1/attachments", headers=admin_headers, files={"file": ("договор.pdf", content, "application/pdf")}).json()
    on_disk = next(TEST_ATTACHMENTS.glob(f"{uploaded['id']}.*")).read_bytes()
    assert on_disk.startswith(crypto.FILE_MAGIC) and content not in on_disk
    download = client.get(f"/api/v1/attachments/{uploaded['id']}", headers=admin_headers)
    assert download.status_code == 200 and download.content == content
    assert "filename*=UTF-8''" in download.headers["content-disposition"]


def test_migration_encrypts_legacy_data_and_rotates_keys(
    client: TestClient, admin_headers: dict[str, str], primary_key
) -> None:
    state = client.get("/api/v1/state", headers=admin_headers).json()["state"]
    uploaded = client.post("/api/v1/attachments", headers=admin_headers, files={"file": ("old.csv", b"name;phone\nIvan;+7900", "text/csv")}).json()
    path = next(TEST_ATTACHMENTS.glob(f"{uploaded['id']}.*"))

    # Как было до шифрования: открытый JSON в базе и открытый файл на диске.
    with sqlite3.connect(TEST_DATABASE) as connection:
        connection.execute("UPDATE state_snapshots SET state = ?", (json.dumps(state, ensure_ascii=False),))
    path.write_bytes(b"name;phone\nIvan;+7900")
    assert client.get("/api/v1/state", headers=admin_headers).json()["state"] == state  # читается и так

    with SessionLocal() as db:
        report = encrypt_existing_data(db)
    assert report["state_snapshots.state"] == 1 and report["attachments"] >= 1
    assert "$enc" in _raw("SELECT state FROM state_snapshots")[0][0]
    assert path.read_bytes().startswith(crypto.FILE_MAGIC)
    with SessionLocal() as db:
        assert set(encrypt_existing_data(db).values()) == {0}  # Идемпотентно.

    # Ротация: новый ключ становится основным, старый остаётся для чтения, скрипт перешифровывает всё.
    primary_key(OLD_FIRST)
    with SessionLocal() as db:
        rotated = encrypt_existing_data(db)
    assert rotated["state_snapshots.state"] == 1 and rotated["attachments"] >= 1
    assert json.loads(_raw("SELECT state FROM state_snapshots")[0][0])["kid"] == "test-old"
    assert client.get(f"/api/v1/attachments/{uploaded['id']}", headers=admin_headers).content == b"name;phone\nIvan;+7900"
    assert client.get("/api/v1/state", headers=admin_headers).json()["state"] == state


def test_production_refuses_to_start_without_key(primary_key, monkeypatch: pytest.MonkeyPatch) -> None:
    primary_key(None)
    monkeypatch.setattr(settings, "app_env", "production")
    with pytest.raises(RuntimeError, match="DATA_ENCRYPTION_KEYS"):
        crypto.get_keyring()


def test_security_headers(client: TestClient, admin_headers: dict[str, str]) -> None:
    response = client.get("/api/v1/state", headers={**admin_headers, "X-Forwarded-Proto": "https"})
    csp = response.headers["content-security-policy"]
    assert "script-src 'self'" in csp and "frame-ancestors 'none'" in csp and "object-src 'none'" in csp
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["strict-transport-security"].startswith("max-age=")
    assert "content-security-policy" not in client.get("/docs").headers  # Swagger UI грузится с CDN.
