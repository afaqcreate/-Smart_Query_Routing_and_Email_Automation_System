from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models.table import Query, Student, User
from app.schemas.subschemas import QueryPayload


def save_query_to_db(db: Session, payload: QueryPayload, assigned_department: str):

  # 1. Verify student exists
  student = db.scalar(select(Student).where(Student.id == payload.student_id))
  if not student:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Student account with ID '{payload.student_id}' not found.",
    )

  # 2. Find the mentor/user for this department role (case-insensitive search is safer)
  mentor = db.scalar(
      select(User).where(func.lower(User.role) == assigned_department.lower())
  )

  # 3. Handle fallback safely
  if mentor:
    assigned_user_id = mentor.id
  else:
    assigned_department = "General"
    # Try finding an admin case-insensitively
    default_admin = db.scalar(
        select(User).where(func.lower(User.role) == "admin")
    )

    if default_admin:
      assigned_user_id = default_admin.id
    else:
      # If no admin exists at all, raise a proper 500 error instead of guessing ID 1
      raise HTTPException(
          status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
          detail=(
              "Routing fallback failed: No department mentor and no default"
              " admin account found in the system."
          ),
      )

  # 4. Create and save the query
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