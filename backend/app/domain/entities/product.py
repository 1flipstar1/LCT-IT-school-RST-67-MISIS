from dataclasses import dataclass
from uuid import UUID


@dataclass
class ITProduct:
    id: UUID
    vendor: str
    name: str