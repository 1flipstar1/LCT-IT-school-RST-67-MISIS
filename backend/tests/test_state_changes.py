from fastapi.testclient import TestClient


def _reset(client: TestClient, admin_headers: dict[str, str]) -> None:
    assert client.post("/api/v1/state/reset", headers=admin_headers, json={}).status_code == 200


def test_changes_from_different_users_do_not_overwrite_each_other(
    client: TestClient, admin_headers: dict[str, str], manager_headers: dict[str, str]
) -> None:
    _reset(client, admin_headers)
    base = client.get("/api/v1/state", headers=manager_headers).json()
    own = next(item for item in base["state"]["interactions"] if item["managerId"] == "usr-1")

    # Руководитель и менеджер сохраняют, не зная об изменениях друг друга.
    lead = client.post("/api/v1/auth/demo", json={"role": "lead"}).json()["accessToken"]
    lead_report = {"id": "r-lead", "name": "Отчёт руководителя", "createdAt": "2026-09-28T10:00:00Z", "userId": "usr-6", "format": "pdf", "rowCount": 1, "summary": ""}
    response = client.post(
        "/api/v1/state/changes",
        headers={"Authorization": f"Bearer {lead}"},
        json={"changes": {"reports": {"op": "list", "prepend": [lead_report]}}},
    )
    assert response.status_code == 200

    comment = {"id": "e-manager", "interactionId": own["id"], "type": "comment", "userId": "usr-1", "at": "2026-09-28T10:00:01Z", "comment": "Созвонились", "files": []}
    response = client.post(
        "/api/v1/state/changes",
        headers=manager_headers,
        json={"changes": {"events": {"op": "list", "append": [comment]}}},
    )
    assert response.status_code == 200

    state = client.get("/api/v1/state", headers=admin_headers).json()["state"]
    assert any(item["id"] == "r-lead" for item in state["reports"])
    assert state["events"][-1]["id"] == "e-manager"


def test_changes_are_authorised_and_validated(
    client: TestClient, admin_headers: dict[str, str], manager_headers: dict[str, str]
) -> None:
    _reset(client, admin_headers)
    full = client.get("/api/v1/state", headers=admin_headers).json()["state"]
    foreign = next(item for item in full["interactions"] if item["managerId"] != "usr-1")

    response = client.post(
        "/api/v1/state/changes",
        headers=manager_headers,
        json={"changes": {"interactions": {"op": "list", "set": [{**foreign, "comment": "подмена"}]}}},
    )
    assert response.status_code == 403

    response = client.post(
        "/api/v1/state/changes",
        headers=manager_headers,
        json={"changes": {"users": {"op": "list", "set": [{**next(u for u in full["users"] if u["id"] == "usr-1"), "role": "admin"}]}}},
    )
    assert response.status_code == 403

    response = client.post("/api/v1/state/changes", headers=manager_headers, json={"changes": {"events": {"op": "drop"}}})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_changes"

    response = client.post("/api/v1/state/changes", json={"changes": {"events": {"op": "list"}}})
    assert response.status_code == 401


def test_only_lead_and_admin_delete_interactions(
    client: TestClient, admin_headers: dict[str, str], manager_headers: dict[str, str]
) -> None:
    _reset(client, admin_headers)
    state = client.get("/api/v1/state", headers=manager_headers).json()["state"]
    own = next(item for item in state["interactions"] if item["managerId"] == "usr-1")
    own_events = [event for event in state["events"] if event["interactionId"] == own["id"]]
    delete = {
        "interactions": {"op": "list", "remove": [own["id"]]},
        "events": {"op": "list", "remove": [event["id"] for event in own_events]},
    }

    response = client.post("/api/v1/state/changes", headers=manager_headers, json={"changes": delete})
    assert response.status_code == 403

    lead = client.post("/api/v1/auth/demo", json={"role": "lead"}).json()["accessToken"]
    response = client.post("/api/v1/state/changes", headers={"Authorization": f"Bearer {lead}"}, json={"changes": delete})
    assert response.status_code == 200
    saved = client.get("/api/v1/state", headers=admin_headers).json()["state"]
    assert all(item["id"] != own["id"] for item in saved["interactions"])
    assert all(event["interactionId"] != own["id"] for event in saved["events"])


def test_lead_can_unassign_manager_and_still_sees_the_interaction(
    client: TestClient, admin_headers: dict[str, str], manager_headers: dict[str, str]
) -> None:
    _reset(client, admin_headers)
    lead = {"Authorization": f"Bearer {client.post('/api/v1/auth/demo', json={'role': 'lead'}).json()['accessToken']}"}
    own = next(item for item in client.get("/api/v1/state", headers=manager_headers).json()["state"]["interactions"] if item["managerId"] == "usr-1")

    unassign = {"interactions": {"op": "list", "set": [{**own, "managerId": None}]}}
    assert client.post("/api/v1/state/changes", headers=manager_headers, json={"changes": unassign}).status_code == 403
    assert client.post("/api/v1/state/changes", headers=lead, json={"changes": unassign}).status_code == 200

    visible = client.get("/api/v1/state", headers=lead).json()["state"]["interactions"]
    assert next(item for item in visible if item["id"] == own["id"])["managerId"] is None
    assert all(item["id"] != own["id"] for item in client.get("/api/v1/state", headers=manager_headers).json()["state"]["interactions"])
