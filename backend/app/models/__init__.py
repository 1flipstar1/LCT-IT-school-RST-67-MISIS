"""Модели таблиц, с которыми работает API."""

from app.models.base import Base
from app.models.attachment import AttachmentModel
from app.models.import_job import ImportJobModel
from app.models.state import StateSnapshotModel
from app.models.telegram_delivery import TelegramDeliveryModel

__all__ = ["AttachmentModel", "Base", "ImportJobModel", "StateSnapshotModel", "TelegramDeliveryModel"]
