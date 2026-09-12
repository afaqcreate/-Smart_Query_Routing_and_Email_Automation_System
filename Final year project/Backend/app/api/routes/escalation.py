from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

from app.database.connection import get_db

from app.schemas.escalation import EscalationCreate, EscalationResponse

from app.services.escalation import (
    create_escalation,
    get_escalations,
    get_escalation
)


router = APIRouter(
    prefix="/api/escalation",
    tags=["Escalation"]
)


@router.post("/", response_model=EscalationResponse)
def create_new_escalation(
    ticket: EscalationCreate,
    db: Session = Depends(get_db)
):

    return create_escalation(db, ticket)


@router.get("/", response_model=list[EscalationResponse])
def read_escalations(
    db: Session = Depends(get_db)
):

    return get_escalations(db)


@router.get("/{escalation_id}", response_model=EscalationResponse)
def read_escalation(
    escalation_id: int,
    db: Session = Depends(get_db)
):

    escalation = get_escalation(db, escalation_id)
    if not escalation:
        raise HTTPException(status_code=404, detail="Escalation not found")
    
    return escalation