from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, ConfigDict, field_serializer

PKT = timezone(timedelta(hours=5))

class RouteCreate(BaseModel):
    destination: str

class RouteResponse(BaseModel):
    route_id: int
    query_id: int
    destination: str
    routed_at: datetime  # FIXED: name matches database 'routed_at' column

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("routed_at")
    def serialize_datetime(self, dt: datetime) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(PKT).strftime("%Y-%m-%d %I:%M:%S %p")
