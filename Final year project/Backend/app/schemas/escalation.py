from pydantic import BaseModel


class EscalationCreate(BaseModel):

    escalated_to: str

    reason: str


class EscalationResponse(BaseModel):

    escalation_id: int

    query_id: int

    escalated_to: str

    escalated_at: str

    reason: str


    class Config:
        from_attributes = True  