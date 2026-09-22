from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


TEST_DATABASE = Path(__file__).resolve().parent / "test_state.db"
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DATABASE.as_posix()}"
os.environ["JWT_SECRET"] = "test-secret-that-is-not-used-outside-tests"

from app.main import app  # noqa: E402
from app.core.database import engine  # noqa: E402


@pytest.fixture(scope="session")
def client():
    if TEST_DATABASE.exists():
        TEST_DATABASE.unlink()
    with TestClient(app) as test_client:
        yield test_client
    engine.dispose()
    if TEST_DATABASE.exists():
        TEST_DATABASE.unlink()
