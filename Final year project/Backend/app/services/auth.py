from fastapi import HTTPException, status
from sqlalchemy import select, exists
from sqlalchemy.orm import Session
from app.models.table import User, Student
from app.schemas.subschemas import StudentCreate, AccountDeleteRequest


def user_role(db: Session, account_data: StudentCreate):

    role = None

    if account_data.role == "student":
        
        pass