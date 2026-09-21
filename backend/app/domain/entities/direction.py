from dataclasses import dataclass
from uuid import UUID


@dataclass
class ITDirection:
    id: UUID
    name: str