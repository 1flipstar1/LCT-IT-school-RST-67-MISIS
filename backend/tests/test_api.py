from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import settings


def test_health_and_seeded_state(client: TestClient) -> None:
    health = client.get("/api/v1/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    response = client.get("/api/v1/state")
    assert response.status_code == 200
    snapshot = response.json()
    assert snapshot["revision"] >= 1
    assert snapshot["state"]["version"] == 5
    assert snapshot["state"]["users"]
    assert snapshot["state"]["workflows"]
    assert "updatedAt" in snapshot


def test_optimistic_lock_force_and_reset(client: TestClient) -> None:
    original = client.post("/api/v1/state/reset", json={"force": True}).json()
    changed_state = {**original["state"], "testMarker": "first"}

    saved = client.put(
        "/api/v1/state",
        json={
            "state": changed_state,
            "expectedRevision": original["revision"],
            "force": False,
        },
    )
    assert saved.status_code == 200
    assert saved.json()["revision"] == original["revision"] + 1

    conflict = client.put(
        "/api/v1/state",
        json={
            "state": changed_state,
            "expectedRevision": original["revision"],
            "force": False,
        },
    )
    assert conflict.status_code == 409
    error = conflict.json()["error"]
    assert error["code"] == "revision_conflict"
    assert error["details"]["currentRevision"] == saved.json()["revision"]

    forced = client.put(
        "/api/v1/state",
        json={
            "state": {**changed_state, "testMarker": "forced"},
            "expectedRevision": original["revision"],
            "force": True,
        },
    )
    assert forced.status_code == 200
    assert forced.json()["state"]["testMarker"] == "forced"

    reset = client.post(
        "/api/v1/state/reset",
        json={"expectedRevision": forced.json()["revision"]},
    )
    assert reset.status_code == 200
    assert "testMarker" not in reset.json()["state"]


def test_demo_auth_and_me(client: TestClient) -> None:
    response = client.post("/api/v1/auth/demo", json={"role": "admin"})
    assert response.status_code == 200
    body = response.json()
    assert set(("accessToken", "tokenType", "user", "expiresIn")) <= body.keys()
    assert body["user"]["role"] == "admin"

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {body['accessToken']}"},
    )
    assert me.status_code == 200
    assert me.json()["id"] == body["user"]["id"]
    assert me.json()["role"] == "admin"


def test_facades_and_filters(client: TestClient) -> None:
    catalogs = client.get("/api/v1/catalogs")
    assert catalogs.status_code == 200
    assert catalogs.json()["data"]["universities"]

    all_interactions = client.get("/api/v1/interactions").json()
    own = client.get("/api/v1/interactions", params={"managerId": "usr-1"}).json()
    assert all_interactions["total"] >= own["total"] > 0
    assert all(item["managerId"] == "usr-1" for item in own["items"])

    for resource in ("workflows", "users", "audit", "integrations", "reports"):
        assert client.get(f"/api/v1/{resource}").status_code == 200


def test_production_state_requires_bearer(client: TestClient) -> None:
    previous = settings.app_env
    settings.app_env = "production"
    try:
        response = client.get("/api/v1/state")
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "unauthorized"
    finally:
        settings.app_env = previous


def test_validation_errors_use_common_shape(client: TestClient) -> None:
    response = client.post("/api/v1/auth/demo", json={"role": "unknown"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
