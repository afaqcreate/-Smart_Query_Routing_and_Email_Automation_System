from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.table import User, Student
from app.schemas.subschemas import UserCreate, UserResponse
from app.services.user import create_user, get_user, get_users

user = APIRouter(prefix="/api/user", tags=["User"])


@user.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_new_user(user_in: UserCreate, db: Session = Depends(get_db)):
    target_email = str(user_in.email).strip().lower()
    existing_user = db.scalar(select(User).where(User.email.ilike(target_email)))
    existing_student = db.scalar(select(Student).where(Student.email.ilike(target_email)))
    if existing_user is not None or existing_student is not None:
        raise HTTPException(status_code=409, detail="A user with this email already exists.")
    try:
        return create_user(db, user_in)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A user with this email already exists.") from exc


@user.get("/", response_model=list[UserResponse])
def read_users(db: Session = Depends(get_db)):
    return get_users(db)


@user.get("/{user_id}", response_model=UserResponse)
def read_user(user_id: int, db: Session = Depends(get_db)):
    result = get_user(db, user_id)
    if result is None:
        raise HTTPException(status_code=404, detail="User not found")
    return result
