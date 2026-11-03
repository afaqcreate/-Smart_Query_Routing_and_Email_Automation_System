from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.table import Query, User, Student, QueryMessage
from app.schemas.subschemas import QueryCreate, MessageCreate, MessageResponse
from app.services.leave_ai import generate_instructor_ai_leave_reply

async def add_query_message(db: Session, query_id: int, payload: MessageCreate):
    query = db.query(Query).filter(Query.query_id == query_id).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")
    
    sender_role = (payload.sender_role or "").strip().lower()
    sender_name = (payload.sender_name or "").strip()

    if not sender_role:
        if query.student_id == payload.sender_id:
            sender_role = "student"
        elif query.user_id == payload.sender_id:
            sender_role = query.user.role.lower() if query.user else "user"
        else:
            user_found = db.query(User).filter(User.id == payload.sender_id).first()
            if user_found:
                sender_role = user_found.role.lower()
                if not sender_name:
                    sender_name = user_found.name or user_found.email
            else:
                student_found = db.query(Student).filter(Student.id == payload.sender_id).first()
                if student_found:
                    sender_role = "student"
                    if not sender_name:
                        sender_name = student_found.name or student_found.email

    if not sender_name:
        if sender_role == "student":
            sender_name = query.student.name if query.student else "Student"
        elif query.user and query.user.role.lower() == sender_role:
            sender_name = query.user.name or query.user.email
        else:
            sender_name = sender_role.title()

    new_message = QueryMessage(
        query_id=query.query_id,
        sender_id=payload.sender_id,
        sender_name=sender_name,
        sender_role=sender_role,
        message_body=payload.message_body
    )

    db.add(new_message)

    query.reply = payload.message_body
    if payload.status:
        query.status = payload.status

    db.commit()
    db.refresh(new_message)
    db.refresh(query)

    # Check for Instructor Out-of-Office Auto-Reply (Only for Instructors)
    if (
        sender_role == "student"
        and query.user
        and (query.user.role or "").lower().strip() == "instructor"
        and getattr(query.user, "leave_status", None)
    ):
        ls = query.user.leave_status
        if ls and ls.is_on_leave and ls.auto_reply_enabled:
            student_name = (query.student.name or "Student") if (query.student and query.student.name) else "Student"
            ai_reply_text = await generate_instructor_ai_leave_reply(
                instructor_name=query.user.name or "Instructor",
                leave_start=ls.leave_start,
                leave_end=ls.leave_end,
                leave_reason=ls.leave_reason,
                custom_guidance=ls.auto_reply_message,
                student_name=student_name,
                query_subject=query.query_subject,
                student_message=payload.message_body,
            )
            auto_msg = QueryMessage(
                query_id=query.query_id,
                sender_id=query.user_id,
                sender_name=f"{query.user.name or 'Instructor'} (AI Auto-Reply)",
                sender_role=query.user.role.lower(),
                message_body=ai_reply_text,
            )
            db.add(auto_msg)
            query.reply = ai_reply_text
            db.commit()
            db.refresh(auto_msg)
    
    return new_message


def create_query(db: Session, query_data: QueryCreate) -> Query:
    user_exists = db.scalar(select(User.id).where(User.id == query_data.user_id))
    if user_exists is None:
        raise ValueError(f"User with ID {query_data.user_id} does not exist.")

    query = Query(**query_data.model_dump())
    db.add(query)
    db.commit()
    db.refresh(query)
    return query


def get_query(db: Session, query_id: int) -> Query | None:
    return db.get(Query, query_id)


def dumped_query_status(db: Session, query_id: int, payload):
    query = db.scalar(select(Query).where(Query.query_id == query_id))
    
    if query is None:
        return None
    
    update_data = payload.model_dump(exclude_unset=True)
    reply_text = update_data.pop("reply", None)
    sender_id = update_data.pop("sender_id", None)
    sender_name = update_data.pop("sender_name", None)
    sender_role = update_data.pop("sender_role", None)

    for key, value in update_data.items():
        setattr(query, key, value)

    if reply_text:
        query.reply = reply_text
        sid = sender_id or query.user_id
        srole = sender_role or (query.user.role if query.user else "support desk")
        sname = sender_name or (query.user.name if query.user else "Support Desk")
        msg = QueryMessage(
            query_id=query.query_id,
            sender_id=sid,
            sender_name=sname,
            sender_role=srole,
            message_body=reply_text
        )
        db.add(msg)

    db.commit()
    db.refresh(query)
    
    return query
