from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.table import Query, User
from app.schemas.query import QueryCreate

def create_query(db: Session, ticket_data: QueryCreate):
    user = db.query(User).filter(User.id == ticket_data.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, # Fixed to explicit standard code
            detail=f"User with ID {ticket_data.user_id} not found"
        )

    db_ticket = Query(
        user_id=ticket_data.user_id,
        student_id=ticket_data.student_id,
        query_subject=ticket_data.query_subject,
        query_body=ticket_data.query_body,
        category=ticket_data.category
    )
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

def get_querys(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Query).offset(skip).limit(limit).all()

def get_query(db: Session, query_id: int):
    if not query_id:
        return None
    return db.query(Query).filter(Query.query_id == query_id).first()
