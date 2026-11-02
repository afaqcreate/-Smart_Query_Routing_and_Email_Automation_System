from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from typing import Union

from app.database.connection import get_db 
from app.models.table import Student, User

from app.schemas.subschemas import StudentCreate, StudentResponse, AccountDeleteRequest, AccountDeleteResponse
from app.schemas.subschemas import UserResponse
from app.services.admin import verificationAccount, deleteAccount

admin = APIRouter(prefix="/api/admin", tags=["Accounts Authorization"])

@admin.get(
    "/", 
    response_model=list[Union[StudentResponse, UserResponse]],
    status_code=status.HTTP_200_OK
)
def get_all_read(db: Session = Depends(get_db)):

    students_list = db.scalars(select(Student)).all()
    users_list = db.scalars(select(User)).all()
    
    combined_accounts = list(students_list) + list(users_list)
    return combined_accounts


@admin.post(
    "/create",
    response_model=Union[StudentResponse, UserResponse],
    status_code=status.HTTP_201_CREATED
)
def verify_and_create_account(
    usersdata: StudentCreate, 
    check_only: bool = False,
    db: Session = Depends(get_db)
):

    processed_account = verificationAccount(db=db, usersdata=usersdata, check_only=check_only)
    return processed_account


@admin.delete(
    "/delete", 
    response_model=AccountDeleteResponse, 
    status_code=status.HTTP_200_OK 
)
def userDeleteAccount(deleteUser: AccountDeleteRequest, db: Session = Depends(get_db)):

    processed_account_delete = deleteAccount(db, deleteUser)
    return processed_account_delete
