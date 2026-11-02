from sqlalchemy import select, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from app.models.table import User, Student
from app.schemas.subschemas import UserCreate

def create_user(db: Session, user_data: UserCreate) -> User:
    user = User(**user_data.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def get_users(db: Session):
    return list(db.scalars(select(User)).all()) + list(db.scalars(select(Student)).all())

def get_user(db: Session, User_id: int):
    try:
        # 1. Try finding the user in the Users table first
        user = db.get(User, User_id)
        if user:
            return user
            
        # 2. If not found in Users, check the Student table
        student = db.get(Student, User_id)
        if student:
            return student
            
        return None
    except SQLAlchemyError as e:
        # Log database errors if needed
        print(f"Database error during user lookup: {e}")
        raise e


