from datetime import datetime
from typing import Optional, List

from pydantic import EmailStr, Field

from app.schemas.base import BaseResponseSchema, BaseModel

class MessageCreate(BaseModel):
    sender_id: int
    message_body: str
    status: Optional[str] = "in_progress"

class MessageResponse(BaseModel):
    message_id: int
    query_id: int
    sender_id: int
    sender_roll: str
    message_body: str
    sent_at: datetime

    class Config:
        from_attributes = True

class AccountDeleteRequest(BaseModel):
    role: str = Field(min_length=1, max_length=50, default="student")
    email: EmailStr
    reason: Optional[str] = Field(default="User requested account closure")

class AccountDeleteResponse(BaseModel):
    success: str



class updatecreateUser(BaseResponseSchema):
    updata: Optional[str] = None

class UpdateResponseUser(BaseResponseSchema):
    updata: Optional[str] = None



class StudentCreate(BaseResponseSchema):
    name: Optional[str] = Field(default=None, max_length=100)
    role: str = Field(min_length=1, max_length=50, default="student")
    email: EmailStr
    roll_number: str
    # update: Optional[updatecreateUser] = None


class StudentResponse(BaseResponseSchema):
    id: int
    name: Optional[str] = None
    email: EmailStr
    role: str
    roll_number: str


class UserCreate(BaseResponseSchema):
    name: Optional[str] = Field(default=None, max_length=100)
    role: str = Field(min_length=1, max_length=50)
    email: EmailStr

class UserResponse(BaseResponseSchema):
    id: int
    name: Optional[str] = None
    email: EmailStr
    role: str
    roll_number: Optional[str] = None


class RouteCreate(BaseResponseSchema):
    destination: str = Field(min_length=1, max_length=50)


class RouteResponse(BaseResponseSchema):
    route_id: int
    query_id: int
    destination: str
    routed_at: datetime


class EscalationCreate(BaseResponseSchema):
    query_id: int
    escalated_to: str = Field(min_length=1, max_length=50)
    reason: Optional[str] = Field(min_length=1)


class EscalationResponse(BaseResponseSchema):
    escalation_id: int
    query_id: int
    escalated_to: str
    escalated_at: datetime
    reason: str


class QueryCreate(BaseResponseSchema):
    user_id: int = Field(gt=0)
    student_id: int = Field(gt=0) # This is temporary
    query_subject: str = Field(min_length=1)
    query_body: str = Field(min_length=1)


class QueryResponse(BaseResponseSchema):
    query_id: int
    user: Optional[UserResponse] = None 
    student: Optional[StudentResponse] = None
    query_subject: str
    query_body: str
    category: Optional[str] = None
    messages: List[MessageResponse] = []
    status: str
    submitted_at: datetime
    route: Optional[RouteResponse] = None
    escalations: list[EscalationResponse] = Field(default_factory=list)


class QueryPayload(BaseModel):
    student_id: int
    email: EmailStr
    query_subject: str
    query_body: str
