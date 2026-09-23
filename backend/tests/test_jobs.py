from __future__ import annotations

from io import BytesIO

import xlwt
from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.services.import_parser import parse_workbook
from app.services.report_writer import create_report


def _token(client: TestClient, role: str = "admin") -> dict[str, str]:
    response = client.post("/api/v1/auth/demo", json={"role": role})
    return {"Authorization": f"Bearer {response.json()['accessToken']}"}


def _xlsx() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["Название ВУЗа", "Вендор", "ПО"])
    sheet.append(["Тестовый технологический университет", "Тест Вендор", "Тест ПО"])
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def test_xls_parser_supports_legacy_workbooks() -> None:
    workbook = xlwt.Workbook(encoding="utf-8")
    sheet = workbook.add_sheet("Импорт")
    values = [["Название ВУЗа", "ПО"], ["Тестовый вуз", "Тестовый продукт"]]
    for row_index, row in enumerate(values):
        for column_index, value in enumerate(row):
            sheet.write(row_index, column_index, value)
    output = BytesIO()
    workbook.save(output)
    assert parse_workbook(output.getvalue(), "legacy.xls") == values


def test_report_writers_support_all_formats_and_cyrillic() -> None:
    for format_name, signature in (("xlsx", b"PK"), ("xls", b"\xd0\xcf\x11\xe0"), ("pdf", b"%PDF")):
        data, content_type = create_report(
            format_name,
            ["Вуз", "Статус"],
            [["Университет ИТМО", "В работе"]],
            title="Проверка отчёта",
            summary="Русский текст",
        )
        assert data.startswith(signature)
        assert content_type


def test_async_import_preview_and_apply(client: TestClient) -> None:
    headers = _token(client)
    client.post("/api/v1/state/reset", json={"force": True})
    response = client.post(
        "/api/v1/imports",
        files={"file": ("catalog.xlsx", _xlsx(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=headers,
    )
    assert response.status_code == 202
    job = response.json()
    assert job["status"] == "ready"
    mapping = job["result"]["suggestedMapping"]

    preview = client.post(f"/api/v1/imports/{job['id']}/preview", json={"mapping": mapping}, headers=headers)
    assert preview.status_code == 200
    assert preview.json()["stats"]["newUniversities"] == 1

    applied = client.post(f"/api/v1/imports/{job['id']}/apply", json={"mapping": mapping}, headers=headers)
    assert applied.status_code == 202
    assert applied.json()["status"] == "completed"
    assert applied.json()["result"]["stats"]["newProducts"] == 1
    state = client.get("/api/v1/state").json()["state"]
    assert any(item["name"] == "Тестовый технологический университет" for item in state["universities"])
    audit = next(item for item in state["audit"] if item["target"]["type"] == "import")
    assert audit["userId"] == "usr-8"
    assert "actorId" not in audit


def test_import_requires_lead_or_admin(client: TestClient) -> None:
    response = client.post(
        "/api/v1/imports",
        files={"file": ("catalog.xlsx", _xlsx(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=_token(client, "manager"),
    )
    assert response.status_code == 403


def test_report_worker_and_download(client: TestClient) -> None:
    headers = _token(client, "manager")
    response = client.post(
        "/api/v1/report-jobs",
        json={
            "name": "Проверка отчёта",
            "format": "xlsx",
            "summary": "Две строки",
            "table": {"header": ["Вуз", "Статус"], "body": [["ИТМО", "В работе"], ["КФУ", "Завершено"]]},
            "filters": {"period": {"preset": "all"}},
            "columns": ["university", "stage"],
        },
        headers=headers,
    )
    assert response.status_code == 202
    job = response.json()
    assert job["status"] == "completed"
    assert job["result"]["rowCount"] == 2

    download = client.get(f"/api/v1/report-jobs/{job['id']}/download", headers=headers)
    assert download.status_code == 200
    assert download.content.startswith(b"PK")
    assert "filename*=UTF-8''" in download.headers["content-disposition"]

    state = client.get("/api/v1/state", headers=headers).json()["state"]
    audit = next(item for item in state["audit"] if item.get("target", {}).get("type") == "report")
    assert audit["userId"] == "usr-1"
    assert "actorId" not in audit
