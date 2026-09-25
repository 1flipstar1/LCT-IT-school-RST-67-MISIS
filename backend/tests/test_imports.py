"""Imports are applied atomically, recorded in history and can be rolled back."""

from __future__ import annotations

from fastapi.testclient import TestClient


def _state(client: TestClient, headers: dict[str, str]) -> dict:
    return client.get("/api/v1/state", headers=headers).json()


def _import_payload(snapshot: dict, *, university_name: str) -> dict:
    universities = snapshot["state"]["universities"] + [
        {"id": f"u-import-{university_name}", "name": university_name, "shortName": university_name, "city": "", "contacts": []}
    ]
    return {
        "fileName": "Вузы.xlsx",
        "expectedRevision": snapshot["revision"],
        "summary": f"Импорт: новый вуз {university_name}",
        "options": {"createInteractions": False},
        "stats": {"rows": 1, "newUniversities": 1},
        "issues": [{"rowNumber": 3, "level": "warning", "message": "Менеджер не найден"}],
        "changes": {"universities": universities},
    }


def test_import_is_applied_recorded_and_rolled_back(client: TestClient, admin_headers: dict[str, str]) -> None:
    before = _state(client, admin_headers)
    response = client.post("/api/v1/imports", json=_import_payload(before, university_name="ПНИПУ"), headers=admin_headers)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["snapshot"]["revision"] == before["revision"] + 1
    assert any(item["name"] == "ПНИПУ" for item in body["snapshot"]["state"]["universities"])
    assert body["snapshot"]["state"]["audit"][0]["target"]["type"] == "import"
    job = body["job"]
    assert job["status"] == "applied" and job["canRollback"] is True and job["issueCount"] == 1

    history = client.get("/api/v1/imports", headers=admin_headers).json()
    assert history[0]["id"] == job["id"]
    detail = client.get(f"/api/v1/imports/{job['id']}", headers=admin_headers).json()
    assert detail["issues"][0]["rowNumber"] == 3

    rolled = client.post(f"/api/v1/imports/{job['id']}/rollback", headers=admin_headers)
    assert rolled.status_code == 200, rolled.text
    assert not any(item["name"] == "ПНИПУ" for item in rolled.json()["snapshot"]["state"]["universities"])
    assert rolled.json()["job"]["status"] == "rolled_back"
    assert client.post(f"/api/v1/imports/{job['id']}/rollback", headers=admin_headers).status_code == 409


def test_rollback_after_later_changes_needs_confirmation(client: TestClient, admin_headers: dict[str, str]) -> None:
    before = _state(client, admin_headers)
    job = client.post("/api/v1/imports", json=_import_payload(before, university_name="ЮУрГУ"), headers=admin_headers).json()["job"]

    after = _state(client, admin_headers)
    changed = client.put("/api/v1/state", json={"state": after["state"], "expectedRevision": after["revision"]}, headers=admin_headers)
    assert changed.status_code == 200

    conflict = client.post(f"/api/v1/imports/{job['id']}/rollback", headers=admin_headers)
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "import_changed_since"
    assert client.get("/api/v1/imports", headers=admin_headers).json()[0]["canRollback"] is False

    forced = client.post(f"/api/v1/imports/{job['id']}/rollback", json={"force": True}, headers=admin_headers)
    assert forced.status_code == 200


def test_import_checks_revision_role_and_state(client: TestClient, admin_headers: dict[str, str], manager_headers: dict[str, str]) -> None:
    snapshot = _state(client, admin_headers)

    stale = _import_payload(snapshot, university_name="Старый")
    stale["expectedRevision"] = snapshot["revision"] - 1
    assert client.post("/api/v1/imports", json=stale, headers=admin_headers).status_code == 409

    assert client.post("/api/v1/imports", json=_import_payload(snapshot, university_name="Менеджер"), headers=manager_headers).status_code == 403
    assert client.get("/api/v1/imports", headers=manager_headers).status_code == 403

    broken = _import_payload(snapshot, university_name="Сломанный")
    broken["changes"] = {"interactions": [{"id": "x", "universityId": "нет"}]}
    assert client.post("/api/v1/imports", json=broken, headers=admin_headers).status_code == 422
    assert client.get("/api/v1/imports", headers=admin_headers).json()[0]["fileName"] == "Вузы.xlsx"
    assert _state(client, admin_headers)["revision"] == snapshot["revision"], "неудачный импорт не меняет данные"

    forbidden_key = _import_payload(snapshot, university_name="Пользователи")
    forbidden_key["changes"] = {"users": []}
    assert client.post("/api/v1/imports", json=forbidden_key, headers=admin_headers).status_code == 422


def test_lead_import_merges_into_the_visible_part_of_the_state(client: TestClient, admin_headers: dict[str, str]) -> None:
    token = client.post("/api/v1/auth/demo", json={"role": "lead"}).json()["accessToken"]
    lead = {"Authorization": f"Bearer {token}"}
    full_before = _state(client, admin_headers)["state"]
    snapshot = _state(client, lead)

    response = client.post("/api/v1/imports", json=_import_payload(snapshot, university_name="СамГТУ"), headers=lead)
    assert response.status_code == 200, response.text

    full_after = _state(client, admin_headers)["state"]
    assert len(full_after["interactions"]) == len(full_before["interactions"]), "невидимые руководителю взаимодействия сохранены"
    assert any(item["name"] == "СамГТУ" for item in full_after["universities"])

    rolled = client.post(f"/api/v1/imports/{response.json()['job']['id']}/rollback", headers=lead)
    assert rolled.status_code == 200, rolled.text
    assert _state(client, admin_headers)["state"]["universities"] == full_before["universities"]
