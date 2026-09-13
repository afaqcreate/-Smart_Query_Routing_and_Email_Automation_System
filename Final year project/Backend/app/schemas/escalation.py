from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, ConfigDict, field_serializer

PKT = timezone(timedelta(hours=5))

class EscalationCreate(BaseModel):
    escalated_to: str
    reason: str

class EscalationResponse(BaseModel):
    escalation_id: int
    query_id: int
    escalated_to: str
    escalated_at: datetime
    reason: str

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("escalated_at")
    def serialize_datetime(self, dt: datetime) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(PKT).strftime("%Y-%m-%d %I:%M:%S %p")
