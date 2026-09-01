from fastapi import APIRouter, Depends

from sqlalchemy.orm import Session

from app.database.connection import get_db

from app.schemas.auth import AuthCreate, AuthResponse

from app.services.query import (
    create_auth,
    get_auth,
    get_auth
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Auth"]
)


@router.post("/", response_model=AuthResponse)
def create_new_auth(
    ticket: AuthCreate,
    db: Session = Depends(get_db)
):

    return create_auth(db, ticket)


@router.get("/", response_model=list[AuthResponse])
def read_auth(
    db: Session = Depends(get_db)
):

    return get_auth(db)


@router.get("/{auth_id}", response_model=AuthResponse)
def read_auth(
    auth_id: int,
    db: Session = Depends(get_db)
):

    return get_auth(db, auth_id)