from sqlalchemy.orm import Session

from app.models.table import User
from app.schemas.user import UserCreate


def create_user(db: Session, user_data: UserCreate):

    user = User(
        name=user_data.name,
        email=user_data.email,
        role=user_data.role,
        department= user_data.department
    )

    db.add(user)

    db.commit()

    db.refresh(user)

    return user


def get_users(db: Session):

    return db.query(User).all()


def get_user(db: Session, user_id: int):

    return db.query(User).filter(User.id == user_id).first()