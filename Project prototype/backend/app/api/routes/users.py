from fastapi import APIRouter, Depends

from sqlalchemy.orm import Session

from app.database.connection import get_db

from app.schemas.user import UserCreate, UserResponse

from app.services.user_service import (
    create_user,
    get_users,
    get_user
)


router = APIRouter(
    prefix="/api/users",
    tags=["Users"]
)


@router.post("/", response_model=UserResponse)
def create_new_user(
    user: UserCreate,
    db: Session = Depends(get_db)
):

    return create_user(db, user)


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

    return get_user(db, user_id)