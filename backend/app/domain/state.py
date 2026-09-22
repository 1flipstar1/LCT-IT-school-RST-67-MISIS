"""Server-side invariants and authorization for the aggregate snapshot.

The browser keeps an optimistic local copy for sub-second UX, but it is never
trusted as an authorization boundary. Every replacement is checked here before
it reaches the database.
"""

from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

from app.core.errors import APIError
from app.core.security import Principal


STATE_VERSION = 5
REQUIRED_ARRAYS = (
    "universities",
    "directions",
    "programs",
    "products",
    "users",
    "workflows",
    "interactions",
    "events",
    "metrics",
    "inbox",
    "reports",
    "audit",
)
ATTACHMENT_EXTENSIONS = {
    "png", "jpg", "jpeg", "pdf", "zip", "gz", "gzip", "rar", "doc", "docx", "xls", "xlsx"
}


def _items_by_id(state: dict[str, Any], key: str) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for item in state.get(key, []):
        if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"]:
            raise APIError(422, "invalid_state", f"В разделе «{key}» найдена запись без id.")
        if item["id"] in result:
            raise APIError(422, "invalid_state", f"В разделе «{key}» повторяется id {item['id']}.")
        result[item["id"]] = item
    return result


def validate_state(state: dict[str, Any], *, max_attachment_bytes: int) -> None:
    if state.get("version") != STATE_VERSION:
        raise APIError(422, "invalid_state", f"Поддерживается версия состояния {STATE_VERSION}.")
    missing = [key for key in REQUIRED_ARRAYS if not isinstance(state.get(key), list)]
    if missing:
        raise APIError(422, "invalid_state", "В состоянии отсутствуют обязательные разделы.", {"fields": missing})
    integrations = state.get("integrations")
    if not isinstance(integrations, dict) or not isinstance(integrations.get("sources"), list) or not isinstance(integrations.get("log"), list):
        raise APIError(422, "invalid_state", "Раздел integrations имеет неверную структуру.")

    universities = _items_by_id(state, "universities")
    directions = _items_by_id(state, "directions")
    programs = _items_by_id(state, "programs")
    products = _items_by_id(state, "products")
    users = _items_by_id(state, "users")
    workflows = _items_by_id(state, "workflows")
    interactions = _items_by_id(state, "interactions")

    workflow_stages: dict[str, set[str]] = {}
    for workflow_id, workflow in workflows.items():
        stages = workflow.get("stages")
        if not isinstance(stages, list) or not stages:
            raise APIError(422, "invalid_state", "Workflow должен содержать хотя бы один этап.", {"workflowId": workflow_id})
        stage_ids: set[str] = set()
        for index, stage in enumerate(stages):
            if not isinstance(stage, dict) or not isinstance(stage.get("id"), str) or not str(stage.get("name", "")).strip():
                raise APIError(422, "invalid_state", "Этап workflow заполнен не полностью.", {"workflowId": workflow_id, "index": index})
            if stage["id"] in stage_ids:
                raise APIError(422, "invalid_state", "В workflow повторяется id этапа.", {"workflowId": workflow_id, "stageId": stage["id"]})
            if not isinstance(stage.get("slaDays"), int) or stage["slaDays"] <= 0:
                raise APIError(422, "invalid_state", "Норматив этапа должен быть положительным числом дней.", {"stageId": stage["id"]})
            stage_ids.add(stage["id"])
        if stages[0].get("optional"):
            raise APIError(422, "invalid_state", "Первый этап workflow не может быть необязательным.", {"workflowId": workflow_id})
        workflow_stages[workflow_id] = stage_ids

    for program_id, program in programs.items():
        if program.get("directionId") not in directions:
            raise APIError(422, "invalid_state", "Программа ссылается на неизвестное направление.", {"programId": program_id})
        product_ids = program.get("productIds")
        if not isinstance(product_ids, list) or any(product_id not in products for product_id in product_ids):
            raise APIError(422, "invalid_state", "Программа ссылается на неизвестный продукт.", {"programId": program_id})

    for interaction_id, interaction in interactions.items():
        references = {
            "universityId": universities,
            "directionId": directions,
            "programId": programs,
            "productId": products,
            "managerId": users,
            "workflowId": workflows,
        }
        for field, collection in references.items():
            if interaction.get(field) not in collection:
                raise APIError(422, "invalid_state", f"Взаимодействие ссылается на неизвестное поле {field}.", {"interactionId": interaction_id})
        program = programs[interaction["programId"]]
        if program.get("directionId") != interaction.get("directionId") or interaction.get("productId") not in program.get("productIds", []):
            raise APIError(422, "invalid_state", "Программа, направление и продукт взаимодействия не согласованы.", {"interactionId": interaction_id})
        if interaction.get("stageId") not in workflow_stages[interaction["workflowId"]]:
            raise APIError(422, "invalid_state", "Текущий этап отсутствует в workflow.", {"interactionId": interaction_id})

    event_ids: set[str] = set()
    for event in state["events"]:
        if not isinstance(event, dict) or not isinstance(event.get("id"), str) or event["id"] in event_ids:
            raise APIError(422, "invalid_state", "Событие имеет пустой или повторяющийся id.")
        event_ids.add(event["id"])
        interaction = interactions.get(event.get("interactionId"))
        if interaction is None:
            raise APIError(422, "invalid_state", "Событие ссылается на неизвестное взаимодействие.", {"eventId": event["id"]})
        allowed_stages = workflow_stages[interaction["workflowId"]]
        for field in ("stageId", "fromStageId", "toStageId"):
            value = event.get(field)
            if value is not None and value not in allowed_stages:
                raise APIError(422, "invalid_state", "Событие ссылается на неизвестный этап.", {"eventId": event["id"], "field": field})
        for file in event.get("files", []):
            if not isinstance(file, dict) or not isinstance(file.get("name"), str):
                raise APIError(422, "invalid_state", "Метаданные вложения заполнены не полностью.", {"eventId": event["id"]})
            extension = Path(file["name"]).suffix.lower().lstrip(".")
            size = file.get("size")
            if extension not in ATTACHMENT_EXTENSIONS or not isinstance(size, int) or size < 0 or size > max_attachment_bytes:
                raise APIError(422, "invalid_state", "Вложение имеет недопустимый формат или размер.", {"eventId": event["id"], "name": file["name"]})


def find_principal_user(state: dict[str, Any], principal: Principal) -> dict[str, Any]:
    users = [item for item in state.get("users", []) if isinstance(item, dict)]
    user = next((item for item in users if item.get("id") == principal.subject), None)
    if user is None and principal.email:
        email = principal.email.casefold()
        user = next((item for item in users if str(item.get("email", "")).casefold() == email), None)
    if user is None:
        raise APIError(403, "user_not_registered", "Пользователь не зарегистрирован в CRM.")
    if user.get("active") is False:
        raise APIError(403, "user_blocked", "Учётная запись пользователя заблокирована.")
    return user


def visible_interaction_ids(state: dict[str, Any], user: dict[str, Any]) -> set[str]:
    access = user.get("access") if isinstance(user.get("access"), dict) else {}
    scope = access.get("scope", "own")
    directions = set(access.get("directionIds") or [])
    users = [item for item in state["users"] if isinstance(item, dict)]
    if scope == "all":
        managers = None
    elif scope == "team":
        managers = {item["id"] for item in users if item.get("leadId") == user["id"]}
        managers.add(user["id"])
    else:
        managers = {user["id"]}
    return {
        item["id"]
        for item in state["interactions"]
        if isinstance(item, dict)
        and (managers is None or item.get("managerId") in managers)
        and (not directions or item.get("directionId") in directions)
    }


def _reject(field: str) -> None:
    raise APIError(403, "state_change_forbidden", "Недостаточно прав для этого изменения.", {"field": field})


def authorize_state_replacement(current: dict[str, Any], proposed: dict[str, Any], principal: Principal) -> None:
    role = principal.role
    if role == "admin":
        find_principal_user(current, principal)
        return
    if role not in {"manager", "lead"}:
        raise APIError(403, "role_required", "В токене отсутствует поддерживаемая роль CRM.")

    user = find_principal_user(current, principal)
    if role == "manager":
        mutable = {"interactions", "events", "reports", "audit", "universities"}
    else:
        mutable = set(current) - {"users", "version"}
    for key in set(current) | set(proposed):
        if key not in mutable and proposed.get(key) != current.get(key):
            _reject(key)

    allowed_ids = visible_interaction_ids(current, user)
    current_interactions = {item["id"]: item for item in current["interactions"]}
    proposed_interactions = {item["id"]: item for item in proposed["interactions"]}
    for interaction_id, existing in current_interactions.items():
        if interaction_id not in allowed_ids and proposed_interactions.get(interaction_id) != existing:
            _reject(f"interactions.{interaction_id}")

    users = current["users"]
    team_ids = {item["id"] for item in users if item.get("leadId") == user["id"]}
    team_ids.add(user["id"])
    for interaction_id, item in proposed_interactions.items():
        existing = current_interactions.get(interaction_id)
        if existing is None or existing != item:
            if role == "manager" and item.get("managerId") != user["id"]:
                _reject(f"interactions.{interaction_id}.managerId")
            if role == "lead" and item.get("managerId") not in team_ids:
                _reject(f"interactions.{interaction_id}.managerId")
            if existing is not None and role == "manager" and item.get("managerId") != existing.get("managerId"):
                _reject(f"interactions.{interaction_id}.managerId")

    proposed_allowed_ids = allowed_ids | (set(proposed_interactions) - set(current_interactions))
    for key in ("events", "reports", "audit"):
        current_by_id = {item["id"]: item for item in current[key] if isinstance(item, dict) and "id" in item}
        proposed_by_id = {item["id"]: item for item in proposed[key] if isinstance(item, dict) and "id" in item}
        for item_id, item in current_by_id.items():
            if item_id in proposed_by_id:
                continue
            if key == "events" and item.get("interactionId") not in proposed_allowed_ids:
                _reject(f"events.{item_id}")
            if role == "manager" and item.get("userId") != user["id"]:
                _reject(f"{key}.{item_id}")
        for item in proposed[key]:
            existing = current_by_id.get(item.get("id"))
            if existing == item:
                continue
            if key == "events" and item.get("interactionId") not in proposed_allowed_ids:
                _reject(f"events.{item.get('id')}")
            if role == "manager" and item.get("userId") != user["id"]:
                _reject(f"{key}.{item.get('id')}.userId")

    if role == "manager":
        current_universities = {item["id"]: item for item in current["universities"]}
        proposed_universities = {item["id"]: item for item in proposed["universities"]}
        for university_id, item in current_universities.items():
            if proposed_universities.get(university_id) != item:
                _reject(f"universities.{university_id}")
        new_university_ids = set(proposed_universities) - set(current_universities)
        referenced = {
            item.get("universityId")
            for interaction_id, item in proposed_interactions.items()
            if interaction_id not in current_interactions
        }
        if not new_university_ids <= referenced:
            _reject("universities")


def project_state_for_principal(state: dict[str, Any], principal: Principal | None) -> dict[str, Any]:
    """Return only the records visible to a non-admin user.

    Catalog names remain available for creating a new interaction, while
    university contacts and operational records are restricted to the user's
    data scope.
    """

    if principal is None or principal.role == "admin":
        return copy.deepcopy(state)
    user = find_principal_user(state, principal)
    visible_ids = visible_interaction_ids(state, user)
    interactions = [item for item in state["interactions"] if item["id"] in visible_ids]
    events = [item for item in state["events"] if item.get("interactionId") in visible_ids]
    visible_university_ids = {item["universityId"] for item in interactions}
    visible_pairs = {(item["universityId"], item["directionId"]) for item in interactions}

    access = user.get("access") if isinstance(user.get("access"), dict) else {}
    if access.get("scope") == "team":
        related_user_ids = {item["id"] for item in state["users"] if item.get("leadId") == user["id"]}
        related_user_ids.add(user["id"])
    else:
        related_user_ids = {user["id"]}
    related_user_ids.update(item.get("userId") for item in events if item.get("userId"))

    projected = copy.deepcopy(state)
    projected["interactions"] = copy.deepcopy(interactions)
    projected["events"] = copy.deepcopy(events)
    projected["metrics"] = [
        copy.deepcopy(item)
        for item in state["metrics"]
        if (item.get("universityId"), item.get("directionId")) in visible_pairs
    ]
    projected["users"] = [copy.deepcopy(item) for item in state["users"] if item["id"] in related_user_ids]
    projected["universities"] = [
        copy.deepcopy(item) if item["id"] in visible_university_ids else {**copy.deepcopy(item), "contacts": []}
        for item in state["universities"]
    ]
    if principal.role == "manager":
        projected["reports"] = [copy.deepcopy(item) for item in state["reports"] if item.get("userId") == user["id"]]
        projected["audit"] = [copy.deepcopy(item) for item in state["audit"] if item.get("userId") == user["id"]]
        projected["inbox"] = []
        projected["integrations"] = {"sources": [], "log": []}
    else:
        projected["audit"] = [copy.deepcopy(item) for item in state["audit"] if item.get("userId") in related_user_ids]
    return projected


def merge_state_for_principal(
    current: dict[str, Any],
    proposed: dict[str, Any],
    principal: Principal,
) -> dict[str, Any]:
    """Merge a scoped browser snapshot back into the canonical aggregate."""

    if principal.role == "admin":
        return copy.deepcopy(proposed)
    user = find_principal_user(current, principal)
    projected_current = project_state_for_principal(current, principal)
    protected = {"users", "version"}
    if principal.role == "manager":
        protected.update({"directions", "programs", "products", "workflows", "metrics", "inbox", "integrations"})
    for key in protected:
        if proposed.get(key) != projected_current.get(key):
            _reject(key)
    visible_ids = visible_interaction_ids(current, user)
    current_interactions = {item["id"]: item for item in current["interactions"]}
    proposed_interactions: list[dict[str, Any]] = []
    for item in proposed.get("interactions", []):
        existing = current_interactions.get(item.get("id"))
        if existing is not None and item["id"] not in visible_ids:
            if item != existing:
                _reject(f"interactions.{item['id']}")
            continue
        proposed_interactions.append(copy.deepcopy(item))
    new_ids = {item["id"] for item in proposed_interactions} - set(current_interactions)
    allowed_ids = visible_ids | new_ids

    merged = copy.deepcopy(proposed)
    merged["users"] = copy.deepcopy(current["users"])
    merged["metrics"] = copy.deepcopy(current["metrics"])
    merged["interactions"] = [
        copy.deepcopy(item) for item in current["interactions"] if item["id"] not in visible_ids
    ] + proposed_interactions
    current_events = {item["id"]: item for item in current["events"]}
    proposed_events: list[dict[str, Any]] = []
    for item in proposed.get("events", []):
        if item.get("interactionId") in allowed_ids:
            proposed_events.append(copy.deepcopy(item))
            continue
        existing = current_events.get(item.get("id"))
        if existing is not None and item != existing:
            _reject(f"events.{item.get('id')}")
    merged["events"] = [
        copy.deepcopy(item) for item in current["events"] if item.get("interactionId") not in visible_ids
    ] + proposed_events

    if principal.role == "manager":
        for key in ("directions", "programs", "products", "workflows", "inbox", "integrations"):
            merged[key] = copy.deepcopy(current[key])
        current_university_ids = {item["id"] for item in current["universities"]}
        merged["universities"] = copy.deepcopy(current["universities"]) + [
            copy.deepcopy(item)
            for item in proposed.get("universities", [])
            if item.get("id") not in current_university_ids
        ]
        for key in ("reports", "audit"):
            merged[key] = [
                copy.deepcopy(item) for item in current[key] if item.get("userId") != user["id"]
            ] + [copy.deepcopy(item) for item in proposed.get(key, []) if item.get("userId") == user["id"]]
    else:
        team_ids = {item["id"] for item in current["users"] if item.get("leadId") == user["id"]}
        team_ids.add(user["id"])
        merged["audit"] = [
            copy.deepcopy(item) for item in current["audit"] if item.get("userId") not in team_ids
        ] + [copy.deepcopy(item) for item in proposed.get("audit", []) if item.get("userId") in team_ids]
    return merged
