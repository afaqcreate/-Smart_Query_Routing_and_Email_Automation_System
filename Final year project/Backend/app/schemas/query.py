from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, ConfigDict, field_serializer

PKT = timezone(timedelta(hours=5))

class QueryCreate(BaseModel):
    user_id: int
    student_id: str
    query_subject: str
    query_body: str
    category: str

class QueryResponse(BaseModel):
    query_id: int
    user_id: int
    student_id: str
    query_subject: str
    query_body: str
    category: str
    status: str
    submitted_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("submitted_at")
    def serialize_datetime(self, dt: datetime) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(PKT).strftime("%Y-%m-%d %I:%M:%S %p")
