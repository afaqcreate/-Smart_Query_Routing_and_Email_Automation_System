from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.table import User, Student
from app.schemas.subschemas import UserCreate

def create_user(db: Session, user_data: UserCreate) -> User:
    # Professional standard dictionary unpacking, safely devoid of department_id
    user = User(**user_data.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def get_users(db: Session):
    # SQLAlchemy 2.0 Select Statement Pattern
    return list(db.scalars(select(User)).all()) + list(db.scalars(select(Student)).all())

def get_user(db: Session, User_id: int):
    # Modern execution sequence for singular instance filtering
    return db.scalars(select(User).where(User.id == User_id or Student.id == User_id) ).first()


