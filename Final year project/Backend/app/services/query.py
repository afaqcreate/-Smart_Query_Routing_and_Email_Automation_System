from fastapi import HTTPException

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.table import Query, User
from app.models.table import QueryMessage

from app.schemas.subschemas import QueryCreate, MessageCreate, MessageResponse

def add_query_message(db: Session, query_id: int, payload: MessageCreate):
    query = db.query(Query).filter(Query.query_id == query_id).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    new_message = QueryMessage(
        query_id=query.query_id,
        sender_id=payload.sender_id,
        sender_role=query.user.role,
        message_body=payload.message_body
    )

    new_query = Query(
        role = MessageResponse.message_id
    )

    db.add(new_message, new_query)

    if payload.status:
        query.status = payload.status

    db.commit()
    db.refresh(query)
    
    return {"success": "Message stored successfully", "message_id": new_message.message_id}


def create_query(db: Session, query_data: QueryCreate) -> Query:
    user_exists = db.scalar(select(User.id).where(User.id == query_data.user_id))
    if user_exists is None:
        raise ValueError(f"User with ID {query_data.user_id} does not exist.")

    query = Query(**query_data.model_dump())
    db.add(query)
    db.commit()
    db.refresh(query)
    return query


def get_query(db: Session, query_id: int) -> Query | None:
    return db.get(Query, query_id)


def dumped_query_status(db: Session, query_id: int, payload):
    query = db.scalar(select(Query).where(Query.query_id == query_id))
    
    if query is None:
        return None
    
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(query, key, value)

    db.commit()
    db.refresh(query)
    
    return query
