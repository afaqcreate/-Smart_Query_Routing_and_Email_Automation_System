from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.table import Query, Escalation
from app.schemas.subschemas import EscalationCreate, EscalationResponse
from app.services.escalation import create_escalation, get_escalation, get_escalations

escalation = APIRouter(prefix="/api/escalation", tags=["Escalation"])


def check_and_auto_escalate(db: Session):
    """Automatically creates escalation records for unresolved queries older than 24 hours."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=24)
    
    # Find all queries that are unresolved (pending or in_progress) and submitted > 24 hours ago
    unresolved_queries = db.query(Query).filter(
        Query.status.in_(["pending", "in_progress"]),
        Query.submitted_at <= cutoff
    ).all()
    
    for q in unresolved_queries:
        existing = db.query(Escalation).filter(Escalation.query_id == q.query_id).first()
        if not existing:
            new_escalation = Escalation(
                query_id=q.query_id,
                escalated_to="Department Head / Admin",
                reason="Automatic 24-hour escalation for unresolved query."
            )
            db.add(new_escalation)
    db.commit()


@escalation.post("/", response_model=EscalationResponse, status_code=201)
def create_new_escalation(
    escalation_in: EscalationCreate,
    db: Session = Depends(get_db),
):
    if db.get(Query, escalation_in.query_id) is None:
        raise HTTPException(status_code=404, detail="Query not found")
    
    return create_escalation(db, escalation_in)


@escalation.get("/", response_model=list[EscalationResponse])
def read_escalations(db: Session = Depends(get_db)):
    # 🌟 Trigger 24-hour auto-escalation check on fetch
    check_and_auto_escalate(db)
    return get_escalations(db)


@escalation.get("/{escalation_id}", response_model=EscalationResponse)
def read_escalation(escalation_id: int, db: Session = Depends(get_db)):
    result = get_escalation(db, escalation_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Escalation not found")
    return result