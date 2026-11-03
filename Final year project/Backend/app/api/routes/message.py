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

@message.post("/{query_id}/messages", response_model=MessageResponse)
@message.patch("/{query_id}/messages", response_model=MessageResponse)
async def post_query_message(
    query_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db)
):
    updated_message = await add_query_message(db, query_id, payload)
    if not updated_message:
        raise HTTPException(status_code=404, detail="Query not found")
    return updated_message


@message.get("/{query_id}")
def get_query_details(query_id: int, db: Session = Depends(get_db)):
    query = db.query(Query).filter(Query.query_id == query_id).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")
        
    return {
        "query_id": query.query_id,
        "query_subject": query.query_subject,
        "query_body": query.query_body,
        "category": query.category,
        "status": query.status,
        "reply": query.reply,
        "submitted_at": query.submitted_at,
        "student": query.student,
        "user": query.user,
        "messages": [
            {
                "message_id": m.message_id,
                "query_id": m.query_id,
                "sender_id": m.sender_id,
                "sender_name": m.sender_name,
                "sender_role": m.sender_role,
                "message_body": m.message_body,
                "sent_at": m.sent_at
            } for m in sorted(query.messages, key=lambda x: x.sent_at)
        ]
    }