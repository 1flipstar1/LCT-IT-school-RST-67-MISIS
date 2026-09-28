"""Changes a browser made to its copy of the state, applied to the current snapshot.

Mirror of ``frontend/src/store/rebase.js`` (``applyChanges``). The browser sends only what the
user changed since the snapshot the server last accepted from it; the server applies it to the
latest snapshot under a row lock. Concurrent users therefore never overwrite each other and never
receive 409 for unrelated edits — before, every save replaced the whole snapshot and all but one
of the simultaneous writers got a conflict.

Change format per state key:
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
    kept = [
        updates.get(item.get("id"), item)
        for item in items
        if not (isinstance(item, dict) and (item.get("id") in removed or item.get("id") in added))
    ]
    kept_ids = {item.get("id") for item in kept if isinstance(item, dict)}
    # A record the user edited but someone else deleted comes back: the user's edit wins.
    restored = [item for item in parts["set"] if item["id"] not in kept_ids]
    return parts["prepend"] + kept + restored + parts["append"]
