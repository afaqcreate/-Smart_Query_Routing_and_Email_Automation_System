from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

from app.database.connection import get_db

from app.schemas.user import UserCreate, UserResponse

from app.services.user import (
    create_user,
    get_users,
    get_user
)


router = APIRouter(
    prefix="/api/user",
    tags=["User"]
)


@router.post("/", response_model=UserResponse)
def create_new_user(
    ticket: UserCreate,
    db: Session = Depends(get_db)
):

    return create_user(db, ticket)


@router.get("/", response_model=list[UserResponse])
def read_users(
    db: Session = Depends(get_db)
):

    return get_users(db)


@router.get("/{user_id}", response_model=UserResponse)
def read_user(
    user_id: int,
    db: Session = Depends(get_db)
):
    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user
