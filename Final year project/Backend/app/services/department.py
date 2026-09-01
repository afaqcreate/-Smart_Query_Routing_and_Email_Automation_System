from sqlalchemy.orm import Session

from app.models.table import Department
from app.schemas.department import DepartmentCreate


def create_department(db: Session, department_data: DepartmentCreate):

    department = Department(
        name= department_data.name,
        contact_email= department_data.contact_email

    )

    db.add(department)

    db.commit()

    db.refresh(department)

    return department


def get_departments(db: Session):

    return db.query(Department).all()


def get_department(db: Session, department_id: int):

    return db.query(Department).filter(Department.id == department_id).first()