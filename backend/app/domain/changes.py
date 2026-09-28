"""Изменения, которые браузер внёс в свою копию данных, — применяются к актуальному снимку.

Зеркало ``frontend/src/store/rebase.js`` (``applyChanges``). Браузер присылает только то, что
пользователь изменил с момента последнего снимка, принятого от него сервером; сервер накладывает
это на свежий снимок под блокировкой строки. Поэтому одновременные пользователи не затирают
правки друг друга и не получают 409 из-за чужих изменений — раньше каждое сохранение заменяло
снимок целиком, и из одновременных сохранений проходило только одно.

Формат изменения для каждого ключа снимка:
    {"op": "list", "set": [items], "prepend": [items], "append": [items], "remove": [ids]}
    {"op": "object", "fields": {key: change}}
    {"op": "value", "value": ...}
"""

from __future__ import annotations

from typing import Any

from app.core.errors import APIError


def _invalid(path: str) -> APIError:
    return APIError(422, "invalid_changes", "Изменения имеют неверный формат.", {"path": path})


def apply_changes(state: dict[str, Any], changes: dict[str, Any], path: str = "") -> dict[str, Any]:
    result = dict(state)
    for key, change in changes.items():
        result[key] = _apply(result.get(key), change, f"{path}{key}")
    return result


def _apply(current: Any, change: Any, path: str) -> Any:
    if not isinstance(change, dict):
        raise _invalid(path)
    op = change.get("op")
    if op == "value":
        return change.get("value")
    if op == "object":
        fields = change.get("fields")
        if not isinstance(fields, dict):
            raise _invalid(path)
        return apply_changes(current if isinstance(current, dict) else {}, fields, f"{path}.")
    if op != "list":
        raise _invalid(path)

    parts = {name: change.get(name, []) for name in ("set", "prepend", "append", "remove")}
    if not all(isinstance(value, list) for value in parts.values()):
        raise _invalid(path)
    for name in ("set", "prepend", "append"):
        if not all(isinstance(item, dict) and "id" in item for item in parts[name]):
            raise _invalid(f"{path}.{name}")

    items = current if isinstance(current, list) else []
    removed = set(parts["remove"])
    updates = {item["id"]: item for item in parts["set"]}
    added = {item["id"] for item in parts["prepend"] + parts["append"]}
    # Добавляемые записи убираются из текущих: повтор того же сохранения (сеть оборвалась после
    # записи, браузер отправил ещё раз) не создаёт дублей.
    kept = [
        updates.get(item.get("id"), item)
        for item in items
        if not (isinstance(item, dict) and (item.get("id") in removed or item.get("id") in added))
    ]
    kept_ids = {item.get("id") for item in kept if isinstance(item, dict)}
    # Запись, которую пользователь изменил, а кто-то другой удалил, возвращается: правка пользователя важнее.
    restored = [item for item in parts["set"] if item["id"] not in kept_ids]
    return parts["prepend"] + kept + restored + parts["append"]
