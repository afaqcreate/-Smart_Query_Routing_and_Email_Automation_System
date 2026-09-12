from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

from app.database.connection import get_db

from app.schemas.department import DepartmentCreate, DepartmentResponse

from app.services.department import (
    create_department,
    get_departments,
    get_department
)


router = APIRouter(
    prefix="/api/department",
    tags=["Department"]
)


@router.post("/", response_model=DepartmentResponse)
def create_new_department(
    ticket: DepartmentCreate,
    db: Session = Depends(get_db)
):

    return create_department(db, ticket)


@router.get("/", response_model=list[DepartmentResponse])
def read_departments(
    db: Session = Depends(get_db)
):

    return get_departments(db)


@router.get("/{department_id}", response_model=DepartmentResponse)
def read_department(
    department_id: int,
    db: Session = Depends(get_db)
):

    department = get_department(db, department_id)
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    return department