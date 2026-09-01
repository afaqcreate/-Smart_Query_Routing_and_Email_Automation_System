from fastapi import APIRouter, Depends

from sqlalchemy.orm import Session

from app.database.connection import get_db

from app.schemas.query import QueryCreate, QueryResponse

from app.services.query import (
    create_query,
    get_querys,
    get_query
)


router = APIRouter(
    prefix="/api/query",
    tags=["Query"]
)


@router.post("/", response_model=QueryResponse)
def create_new_query(
    ticket: QueryCreate,
    db: Session = Depends(get_db)
):

    return create_query(db, ticket)


@router.get("/", response_model=list[QueryResponse])
def read_querys(
    db: Session = Depends(get_db)
):

    return get_querys(db)


@router.get("/{query_id}", response_model=QueryResponse)
def read_query(
    query_id: int,
    db: Session = Depends(get_db)
):

    return get_query(db, query_id)