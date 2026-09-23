from __future__ import annotations

import os
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


TEST_DATABASE = Path(__file__).resolve().parent / "test_state.db"
TEST_ATTACHMENTS = Path(__file__).resolve().parent / "test_attachments"
TEST_OBJECTS = Path(__file__).resolve().parent / ".test_objects"
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DATABASE.as_posix()}"
os.environ["JWT_SECRET"] = "test-secret-that-is-not-used-outside-tests"
os.environ["ATTACHMENT_STORAGE_PATH"] = str(TEST_ATTACHMENTS)
os.environ["JOB_STORAGE_BACKEND"] = "local"
os.environ["JOB_QUEUE_BACKEND"] = "inline"
os.environ["LOCAL_STORAGE_PATH"] = str(TEST_OBJECTS)

from app.main import app  # noqa: E402
from app.core.database import engine  # noqa: E402


@pytest.fixture(scope="session")
def client():
    if TEST_DATABASE.exists():
        TEST_DATABASE.unlink()
    shutil.rmtree(TEST_ATTACHMENTS, ignore_errors=True)
    shutil.rmtree(TEST_OBJECTS, ignore_errors=True)
    with TestClient(app) as test_client:
        yield test_client
    engine.dispose()
    if TEST_DATABASE.exists():
        TEST_DATABASE.unlink()
    shutil.rmtree(TEST_ATTACHMENTS, ignore_errors=True)
    shutil.rmtree(TEST_OBJECTS, ignore_errors=True)


@pytest.fixture()
def admin_headers(client: TestClient) -> dict[str, str]:
    token = client.post("/api/v1/auth/demo", json={"role": "admin"}).json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def manager_headers(client: TestClient) -> dict[str, str]:
    token = client.post("/api/v1/auth/demo", json={"role": "manager"}).json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}
