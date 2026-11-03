from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models.table import Query, Student, User, QueryMessage
from app.schemas.subschemas import QueryPayload
from app.services.leave_ai import generate_instructor_ai_leave_reply


async def save_query_to_db(db: Session, payload: QueryPayload, assigned_department: str):

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

  # Check for Instructor Out-of-Office Auto-Reply on newly routed query (Only for Instructors)
  if mentor and (mentor.role or "").lower().strip() == "instructor" and getattr(mentor, "leave_status", None):
    ls = mentor.leave_status
    if ls and ls.is_on_leave and ls.auto_reply_enabled:
      ai_reply_text = await generate_instructor_ai_leave_reply(
          instructor_name=mentor.name or "Instructor",
          leave_start=ls.leave_start,
          leave_end=ls.leave_end,
          leave_reason=ls.leave_reason,
          custom_guidance=ls.auto_reply_message,
          student_name=(student.name or "Student") if (student and student.name) else "Student",
          query_subject=payload.query_subject,
          student_message=payload.query_body,
      )
      auto_msg = QueryMessage(
          query_id=new_query.query_id,
          sender_id=mentor.id,
          sender_name=f"{mentor.name or 'Instructor'} (AI Auto-Reply)",
          sender_role=mentor.role.lower(),
          message_body=ai_reply_text,
      )
      db.add(auto_msg)
      new_query.reply = ai_reply_text
      db.commit()

  return new_query