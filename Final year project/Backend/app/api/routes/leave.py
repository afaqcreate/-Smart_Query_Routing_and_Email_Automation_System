import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.config import client
from app.database.connection import get_db
from app.models.table import User, InstructorLeave
from app.schemas.subschemas import (
    LeaveUpdateRequest,
    LeaveResponse,
    AutoReplyGenerateRequest,
    AutoReplyGenerateResponse,
)
from app.services.leave_ai import sanitize_chat_message

instructor_leave_router = APIRouter(prefix="/api/instructor", tags=["Instructor Leave & Auto-Reply"])


@instructor_leave_router.get("/{user_id}/leave", response_model=LeaveResponse)
def get_instructor_leave(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Instructor not found")

    if (user.role or "").lower().strip() != "instructor":
        raise HTTPException(status_code=403, detail="Leave & Auto-Reply mode is only available for Instructors.")

    leave_record = db.query(InstructorLeave).filter(InstructorLeave.user_id == user_id).first()
    if not leave_record:
        default_msg = (
            "I am currently away on leave with limited access to messages. "
            "Your message has been safely logged in the system. "
            "For urgent academic or administrative matters, please reach out to the Head of Department."
        )
        return LeaveResponse(
            user_id=user_id,
            is_on_leave=False,
            leave_start="",
            leave_end="",
            leave_reason="",
            auto_reply_enabled=True,
            auto_reply_message=default_msg,
        )

    return LeaveResponse.from_orm(leave_record)


@instructor_leave_router.post("/{user_id}/leave", response_model=LeaveResponse)
def update_instructor_leave(user_id: int, payload: LeaveUpdateRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Instructor not found")

    if (user.role or "").lower().strip() != "instructor":
        raise HTTPException(status_code=403, detail="Leave & Auto-Reply mode is only available for Instructors.")

    leave_record = db.query(InstructorLeave).filter(InstructorLeave.user_id == user_id).first()
    if not leave_record:
        leave_record = InstructorLeave(
            user_id=user_id,
            is_on_leave=payload.is_on_leave,
            leave_start=payload.leave_start,
            leave_end=payload.leave_end,
            leave_reason=payload.leave_reason,
            auto_reply_enabled=payload.auto_reply_enabled,
            auto_reply_message=payload.auto_reply_message,
        )
        db.add(leave_record)
    else:
        leave_record.is_on_leave = payload.is_on_leave
        leave_record.leave_start = payload.leave_start
        leave_record.leave_end = payload.leave_end
        leave_record.leave_reason = payload.leave_reason
        leave_record.auto_reply_enabled = payload.auto_reply_enabled
        leave_record.auto_reply_message = payload.auto_reply_message

    db.commit()
    db.refresh(leave_record)
    return LeaveResponse.from_orm(leave_record)


@instructor_leave_router.post("/generate-auto-reply", response_model=AutoReplyGenerateResponse)
async def generate_auto_reply_message(payload: AutoReplyGenerateRequest):
    instructor_name = payload.instructor_name or "Instructor"
    start_date = payload.leave_start or "the start date"
    end_date = payload.leave_end or "my scheduled return date"
    reason = payload.leave_reason or "official / academic leave"
    contact = payload.contact_person or "Head of Department"

    fallback_text = (
        f"I am currently on leave ({reason}) from {start_date} to {end_date} with limited access to messages. "
        f"Your message has been safely logged in the system and I will review it upon my return. "
        f"For urgent academic or administrative issues, please contact the {contact}."
    )

    prompt = f"""You are an assistant drafting a concise, student-friendly out-of-office chat message guidance for Instructor {instructor_name}.
Context:
- Instructor Name: {instructor_name}
- Leave Period: from {start_date} to {end_date}
- Reason / Note: {reason}
- Alternate / Urgent Contact: {contact}

STRICT INSTRUCTIONS:
1. DO NOT USE EMAIL FORMATTING:
   - Absolutely NO "Dear...", NO "Hello...", NO "Hi...", and NO letter salutations.
   - Absolutely NO "Best regards", NO "Sincerely", NO "Regards", NO "Thanks", and NO sign-off signatures (do not end with your name or role).
   - This must be a direct, conversational instant message reply suitable for a chat bubble.
2. Content:
   - Concisely inform students that Instructor {instructor_name} is away on leave until {end_date} ({reason}).
   - Clarify that their inquiry is saved and will be reviewed upon return.
   - For urgent matters, direct them to contact {contact}.
3. Length: 2 to 3 natural sentences (under 65 words).
4. Return ONLY the plain chat text without quotation marks or markdown formatting."""

    try:
        call_coro = client.aio.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=prompt,
        )
        response = await asyncio.wait_for(call_coro, timeout=3.5)
        if response and response.text:
            cleaned = sanitize_chat_message(response.text)
            if len(cleaned) > 20:
                return AutoReplyGenerateResponse(auto_reply_message=cleaned)
    except Exception as e:
        print(f"Auto-reply generation error: {e}")

    return AutoReplyGenerateResponse(auto_reply_message=fallback_text)
