from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass
class Interaction:
    id: UUID
    university_id: UUID
    direction_id: UUID
    product_id: UUID
    manager_id: UUID
    workflow_id: UUID
    current_stage_id: UUID
    started_at: datetime