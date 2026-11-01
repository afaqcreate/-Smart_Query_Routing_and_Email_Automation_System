from datetime import datetime, timedelta, timezone

from pydantic import BaseModel, ConfigDict, field_serializer

PKT = timezone(timedelta(hours=5))


class BaseResponseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("submitted_at", "routed_at", "escalated_at", check_fields=False)
    def serialize_datetime(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(PKT).strftime("%Y-%m-%d %I:%M:%S %p")
