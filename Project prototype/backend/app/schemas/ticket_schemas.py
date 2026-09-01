from pydantic import BaseModel

from datetime import datetime


class TicketCreate(BaseModel):

    student_id: str

    email: str

    subject: str

    email_body: str


class TicketResponse(BaseModel):

    ticket_id: int

    student_id: str

    email: str

    subject: str

    email_body: str

    status: str

    routed_to: str

    category: str

    priority: str

    confidence: int

    created_at: datetime

    class Config:
        from_attributes = True  