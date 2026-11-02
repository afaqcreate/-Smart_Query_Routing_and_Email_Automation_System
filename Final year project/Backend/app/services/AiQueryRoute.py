from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models.table import Query, Student, User
from app.schemas.subschemas import QueryPayload


def save_query_to_db(db: Session, payload: QueryPayload, assigned_department: str):

  student = db.scalar(select(Student).where(Student.id == payload.student_id))
  if not student:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Student account with ID '{payload.student_id}' not found.",
    )

  mentor = db.scalar(
      select(User).where(func.lower(User.role) == assigned_department.lower())
  )

  if mentor:
    assigned_user_id = mentor.id
  else:
    assigned_department = "General"
    default_admin = db.scalar(
        select(User).where(func.lower(User.role) == "admin")
    )

    if default_admin:
      assigned_user_id = default_admin.id
    else:
      raise HTTPException(
          status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
          detail=(
              "Routing fallback failed: No department mentor and no default"
              " admin account found in the system."
          ),
      )

  new_query = Query(
      user_id=assigned_user_id,
      student_id=payload.student_id,
      query_subject=payload.query_subject,
      query_body=payload.query_body,
      category=assigned_department,
      status="pending",
  )

  db.add(new_query)
  db.commit()
  db.refresh(new_query)

  return new_query