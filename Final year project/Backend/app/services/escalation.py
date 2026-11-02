from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.table import Escalation
from app.schemas.subschemas import EscalationCreate
from app.models.table import Query
from fastapi import HTTPException, status

def create_escalation(db: Session, escalation_data: EscalationCreate):

    escalation = db.scalar(select(Query).where(Query.query_id == escalation_data.query_id))
    time_escalation = db.scalar(select(Query.submitted_at))

    if not escalation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Query with ID '{escalation}' not found.",
        )

    db_escalation = Escalation(
        query_id= escalation,
        escalation= time_escalation
    )
    
    db.add(db_escalation)
    db.commit()
    db.refresh(db_escalation)
    return db_escalation

def get_escalations(db: Session) -> list[Escalation]:
    return list(db.scalars(select(Escalation)).all())

def get_escalation(db: Session, escalation_id: int) -> Escalation | None:
    return db.scalars(select(Escalation).where(Escalation.escalation_id == escalation_id)).first()
