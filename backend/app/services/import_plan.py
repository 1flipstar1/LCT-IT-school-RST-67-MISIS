"""Catalog import validation and state transformation shared by preview and worker."""

from __future__ import annotations

import re
import uuid
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.errors import APIError


IMPORT_FIELDS = [
    {"id": "university", "label": "Название ВУЗа", "required": True, "aliases": ["вуз", "университет", "название вуза"]},
    {"id": "vendor", "label": "Вендор", "aliases": ["производитель"]},
    {"id": "product", "label": "ПО", "required": True, "aliases": ["продукт", "ит продукт", "ит-продукт"]},
    {"id": "direction", "label": "ИТ-направление", "aliases": ["направление"]},
    {"id": "program", "label": "ИТ-программа", "aliases": ["программа"]},
    {"id": "contract", "label": "Номер договора", "aliases": ["договор"]},
    {"id": "licenseSignedAt", "label": "Дата подписания лицензионного договора", "aliases": ["дата подписания", "лицензия подписана"]},
    {"id": "licenseYears", "label": "Срок действия лицензии (год)", "aliases": ["срок лицензии", "срок действия лицензии"]},
    {"id": "transferStatus", "label": "Статус по передаче", "aliases": ["статус передачи"]},
    {"id": "manager", "label": "ФИО Менеджера", "aliases": ["менеджер", "ответственный", "фио менеджера"]},
    {"id": "contacts", "label": "Ответственные от ВУЗа", "aliases": ["контакт", "ответственный от вуза", "представитель вуза"]},
    {"id": "comment", "label": "Комментарий", "aliases": ["примечание"]},
]
TRANSFER_STATUSES = {"Не передано", "Передано частично", "Передано полностью"}


def normalize(value: Any) -> str:
    return re.sub(r"[^a-zа-я0-9]+", " ", str(value or "").lower().replace("ё", "е")).strip()


def auto_match_columns(headers: list[Any]) -> dict[str, int | str]:
    normalized = [normalize(value) for value in headers]
    result: dict[str, int | str] = {}
    for field in IMPORT_FIELDS:
        candidates = {normalize(field["label"]), *(normalize(alias) for alias in field.get("aliases", []))}
        result[field["id"]] = next((index for index, header in enumerate(normalized) if header in candidates), "")
    return result


def validate_mapping(mapping: dict[str, int | str], width: int) -> dict[str, int | None]:
    normalized: dict[str, int | None] = {}
    for field in IMPORT_FIELDS:
        raw = mapping.get(field["id"], "")
        if raw == "" or raw is None:
            if field.get("required"):
                raise APIError(422, "invalid_import_mapping", f"Не сопоставлено обязательное поле «{field['label']}».")
            normalized[field["id"]] = None
            continue
        try:
            index = int(raw)
        except (TypeError, ValueError) as exc:
            raise APIError(422, "invalid_import_mapping", f"Некорректная колонка для поля «{field['label']}».") from exc
        if index < 0 or index >= width:
            raise APIError(422, "invalid_import_mapping", f"Колонка поля «{field['label']}» отсутствует в файле.")
        normalized[field["id"]] = index
    return normalized


def _id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def _date(value: Any) -> str | None:
    if value in ("", None):
        return ""
    if isinstance(value, (int, float)):
        return (datetime(1899, 12, 30, tzinfo=UTC) + timedelta(days=float(value))).date().isoformat()
    text = str(value).strip()
    match = re.fullmatch(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", text)
    if match:
        return f"{match.group(3)}-{int(match.group(2)):02d}-{int(match.group(1)):02d}"
    return text if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text) else None


def build_import_plan(rows: list[list[Any]], mapping: dict[str, int | str], state: dict[str, Any]) -> dict[str, Any]:
    width = len(rows[0]) if rows else 0
    columns = validate_mapping(mapping, width)
    next_state = deepcopy(state)
    universities = next_state.setdefault("universities", [])
    directions = next_state.setdefault("directions", [])
    programs = next_state.setdefault("programs", [])
    products = next_state.setdefault("products", [])
    interactions = next_state.setdefault("interactions", [])
    users = next_state.setdefault("users", [])
    stats = {"rows": 0, "newUniversities": 0, "newPrograms": 0, "newProducts": 0, "newContacts": 0, "updatedContracts": 0}
    issues: list[dict[str, Any]] = []

    def cell(row: list[Any], field_id: str) -> Any:
        index = columns[field_id]
        return "" if index is None or index >= len(row) else row[index]

    def text(row: list[Any], field_id: str) -> str:
        return str(cell(row, field_id) or "").strip()

    def find(items: list[dict[str, Any]], name: str) -> dict[str, Any] | None:
        target = normalize(name)
        return next((item for item in items if normalize(item.get("name")) == target or normalize(item.get("shortName")) == target), None)

    for row_number, row in enumerate(rows[1:], start=2):
        if all(str(value or "").strip() == "" for value in row):
            continue
        stats["rows"] += 1
        university_name = text(row, "university")
        product_name = text(row, "product")
        if not university_name or not product_name:
            issues.append({"rowNumber": row_number, "level": "error", "message": "Не заполнены «Название ВУЗа» или «ПО» — строка пропущена."})
            continue

        university = find(universities, university_name)
        if university is None:
            university = {"id": _id("u"), "name": university_name, "shortName": university_name, "city": "", "contacts": []}
            universities.append(university)
            stats["newUniversities"] += 1
        university.setdefault("contacts", [])

        product = find(products, product_name)
        if product is None:
            product = {"id": _id("p"), "name": product_name, "vendor": text(row, "vendor") or "Не указан"}
            products.append(product)
            stats["newProducts"] += 1

        direction_name = text(row, "direction")
        program_name = text(row, "program")
        direction = find(directions, direction_name) if direction_name else None
        if direction_name and direction is None:
            issues.append({"rowNumber": row_number, "level": "warning", "message": f"ИТ-направление «{direction_name}» не найдено — программа не добавлена."})
        program = next((item for item in programs if direction and item.get("directionId") == direction.get("id") and normalize(item.get("name")) == normalize(program_name)), None) if program_name else None
        if program_name and direction and program is None:
            program = {"id": _id("pr"), "directionId": direction["id"], "name": program_name, "description": "", "productIds": [product["id"]]}
            programs.append(program)
            stats["newPrograms"] += 1
        elif program is not None and product["id"] not in program.setdefault("productIds", []):
            program["productIds"].append(product["id"])

        for contact_name in filter(None, (part.strip() for part in re.split(r"[;\n]", text(row, "contacts")))):
            if any(normalize(contact.get("name")) == normalize(contact_name) for contact in university["contacts"]):
                continue
            university["contacts"].append({"id": _id("c"), "name": contact_name, "position": "", "email": "", "phone": ""})
            stats["newContacts"] += 1

        manager_name = text(row, "manager")
        manager = find(users, manager_name) if manager_name else None
        if manager_name and manager is None:
            issues.append({"rowNumber": row_number, "level": "warning", "message": f"Менеджер «{manager_name}» не найден среди пользователей — ответственный не изменён."})

        interaction = next((item for item in interactions if item.get("universityId") == university["id"] and item.get("productId") == product["id"] and (program is None or item.get("programId") == program["id"])), None)
        if interaction is None:
            issues.append({"rowNumber": row_number, "level": "warning", "message": f"Нет взаимодействия «{university_name} — {product_name}». Обновлены только справочники."})
            continue

        contract = interaction.setdefault("contract", {})
        signed_at = _date(cell(row, "licenseSignedAt"))
        if signed_at is None:
            issues.append({"rowNumber": row_number, "level": "warning", "message": "Дата подписания лицензии не распознана — оставлена прежняя."})
        try:
            years = int(float(cell(row, "licenseYears")))
        except (TypeError, ValueError):
            years = 0
        transfer_status = text(row, "transferStatus")
        interaction["contract"] = {
            "number": text(row, "contract") or contract.get("number", ""),
            "licenseSignedAt": signed_at or contract.get("licenseSignedAt", ""),
            "licenseYears": years if years > 0 else contract.get("licenseYears"),
            "transferStatus": transfer_status if transfer_status in TRANSFER_STATUSES else contract.get("transferStatus", "Не передано"),
        }
        if manager is not None:
            interaction["managerId"] = manager["id"]
        if text(row, "comment"):
            interaction["comment"] = text(row, "comment")
        stats["updatedContracts"] += 1

    return {"state": next_state, "stats": stats, "issues": issues}
