from dataclasses import dataclass
from uuid import UUID


@dataclass
class University:
    id: UUID
    name: str
    short_name: str | None = None