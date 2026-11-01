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
from app.schemas.subschemas import MessageCreate, QueryResponse, MessageResponse


query = APIRouter(prefix="/api/query", tags=["Query"])


class QueryStatusUpdate(BaseModel):
    status: Literal["pending", "in_progress", "resolved", "ESCALATED_24H"]

# @query.patch("/{query_id}/messages", response_model=MessageResponse)
# def post_query_message(
#     query_id: int,
#     payload: MessageCreate,
#     db: Session = Depends(get_db)
# ):
#     updated_query = add_query_message(db, query_id, payload)
#     if not updated_query:
#         raise HTTPException(status_code=404, detail="Query not found")
#     return updated_query

@query.post("/", response_model=QueryResponse, status_code=201)
def create_new_query(payload: QueryCreate, db: Session = Depends(get_db)):
    try:
        return create_query(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@query.get("/", response_model=list[QueryResponse])
def read_queries(db: Session = Depends(get_db)):
    get_queries = db.scalars(select(Query)).all()
    return get_queries


@query.get("/{query_id}", response_model=QueryResponse)
def read_query(query_id: int, db: Session = Depends(get_db)):
    result = get_query(db, query_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Query not found")
    return result


@query.patch("/{query_id}/status", response_model=QueryResponse)
def update_query_status(
    query_id: int,
    payload: QueryStatusUpdate,
    db: Session = Depends(get_db),
):
    result = dumped_query_status(db, query_id, payload)
    print(result)
    if result is None:
        raise HTTPException(status_code=404, detail="Query not found")  
    return result
