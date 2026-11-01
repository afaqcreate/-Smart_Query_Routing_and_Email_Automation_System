from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query as QueryParam
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database.connection import get_db
from app.models.table import Query
from app.schemas.subschemas import QueryCreate, QueryResponse
from app.services.query import create_query, get_query, dumped_query_status

from app.services.query import add_query_message
from app.schemas.subschemas import MessageCreate, MessageResponse


message = APIRouter(prefix="/api/message", tags=["Message"])

@message.patch("/{query_id}/messages", response_model=MessageResponse)
def post_query_message(
    query_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db)
):
    updated_query = add_query_message(db, query_id, payload)
    if not updated_query:
        raise HTTPException(status_code=404, detail="Query not found")
    return updated_query


@message.get("/{query_id}")
def get_query_details(query_id: int, db: Session = Depends(get_db)):
    query = db.query(Query).filter(Query.query_id == query_id).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")
        
    # Return query along with its threaded messages sorted by date
    return {
        "query_id": query.query_id,
        "query_subject": query.query_subject,
        "query_body": query.query_body,
        "status": query.status,
        "submitted_at": query.submitted_at,
        "student": query.student,
        "messages": [
            {
                "message_id": m.message_id,
                "sender_id": m.sender_id,
                "sender_role": m.sender_role,
                "message_body": m.message_body,
                "sent_at": m.sent_at
            } for m in query.messages
        ]
    }