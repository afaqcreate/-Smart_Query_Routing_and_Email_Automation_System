from sqlalchemy.orm import Session

from app.models.table import Escalation
from app.schemas.escalation import EscalationCreate


def create_escalation(db: Session, escalation_data: EscalationCreate):

    escalation = Escalation(
        escalated_to= escalation_data.escalated_to,
        reason= escalation_data.reason

    )

    db.add(escalation)

    db.commit()

    db.refresh(escalation)

    return escalation


def get_escalations(db: Session):

    return db.query(Escalation).all()


def get_escalation(db: Session, escalation_id: int):

    return db.query(Escalation).filter(Escalation.id == escalation_id).first()