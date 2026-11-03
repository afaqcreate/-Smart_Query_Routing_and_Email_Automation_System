import asyncio
import json
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.config import client
from app.database.connection import get_db
from app.models.table import Announcement, User
from app.schemas.subschemas import (
    AnnouncementCreate,
    AnnouncementResponse,
    AnnouncementAiEnhanceRequest,
    AnnouncementAiEnhanceResponse,
)

announcement_router = APIRouter(prefix="/api/announcements", tags=["Announcements & Broadcasts"])


@announcement_router.post("/", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
def broadcast_announcement(payload: AnnouncementCreate, db: Session = Depends(get_db)):
    """
    Broadcasts a university announcement to students.
    STRICT SECURITY CHECK: Only users with the 'admin' role can broadcast announcements.
    """
    admin = db.query(User).filter(User.id == payload.admin_id).first()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin user account not found.",
        )

    if (admin.role or "").lower().strip() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Only Administrators are authorized to broadcast announcements to students.",
        )

    clean_title = payload.title.strip()
    clean_message = payload.message.strip()
    if not clean_title or not clean_message:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Title and message cannot be empty.",
        )

    new_announcement = Announcement(
        admin_id=admin.id,
        admin_name=admin.name or "Administrator",
        title=clean_title,
        message=clean_message,
        category=(payload.category or "General").strip(),
        priority=(payload.priority or "normal").strip().lower(),
        target_audience=(payload.target_audience or "all_students").strip(),
        is_active=True,
    )

    db.add(new_announcement)
    db.commit()
    db.refresh(new_announcement)
    return new_announcement


@announcement_router.get("/", response_model=List[AnnouncementResponse])
def get_announcements(
    active_only: bool = Query(default=True),
    category: Optional[str] = Query(default=None),
    limit: int = Query(default=50, le=100),
    db: Session = Depends(get_db),
):
    """
    Retrieves broadcast announcements.
    Available to students, staff, and administrators.
    """
    q = db.query(Announcement)
    if active_only:
        q = q.filter(Announcement.is_active == True)
    if category and category.lower() != "all":
        q = q.filter(Announcement.category.ilike(category))

    announcements = q.order_by(Announcement.created_at.desc()).limit(limit).all()
    return announcements


@announcement_router.delete("/{announcement_id}")
def delete_announcement(
    announcement_id: int,
    admin_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """
    Permanently deletes a broadcast announcement.
    STRICT SECURITY: Only administrators can delete announcements.
    """
    admin = db.query(User).filter(User.id == admin_id).first()
    if not admin or (admin.role or "").lower().strip() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Only Administrators can delete announcements.",
        )

    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found.",
        )

    db.delete(announcement)
    db.commit()
    return {"success": True, "message": "Announcement deleted successfully.", "id": announcement_id}


@announcement_router.patch("/{announcement_id}/toggle", response_model=AnnouncementResponse)
def toggle_announcement_status(
    announcement_id: int,
    admin_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """
    Toggles the active/archived status of an announcement.
    STRICT SECURITY: Only administrators can toggle status.
    """
    admin = db.query(User).filter(User.id == admin_id).first()
    if not admin or (admin.role or "").lower().strip() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Only Administrators can modify announcement status.",
        )

    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found.",
        )

    announcement.is_active = not announcement.is_active
    db.commit()
    db.refresh(announcement)
    return announcement


@announcement_router.post("/ai-enhance", response_model=AnnouncementAiEnhanceResponse)
async def ai_enhance_announcement(
    payload: AnnouncementAiEnhanceRequest,
    db: Session = Depends(get_db),
):
    """
    Uses Gemini AI to structure, clarify, and professionally polish a draft announcement before broadcasting.
    Only available to Admin users.
    """
    admin = db.query(User).filter(User.id == payload.admin_id).first()
    if not admin or (admin.role or "").lower().strip() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Only Administrators can use AI broadcast tools.",
        )

    raw_title = payload.title.strip() or "Campus Notice"
    raw_message = payload.raw_message.strip()

    fallback_title = raw_title
    fallback_message = raw_message

    prompt = f"""You are an expert university communications director.
Polish this draft campus broadcast announcement for university students:

Category: {payload.category or 'General'}
Priority: {payload.priority or 'normal'}
Draft Title: {raw_title}
Draft Notes / Message: {raw_message}

Format requirements:
1. Create a clear, engaging, professional title (under 12 words).
2. Rewrite the message to be clear, authoritative, student-friendly, and concise (2 to 4 sentences, under 90 words).
3. Do NOT include email salutations like "Dear Students" or sign-offs like "Best regards". Keep it as a direct announcement broadcast notice.

Return ONLY a valid JSON object in this format:
{{
  "enhanced_title": "...",
  "enhanced_message": "..."
}}"""

    for m_name in ["gemini-3.5-flash-lite", "gemini-3-flash-preview"]:
        try:
            call_coro = client.aio.models.generate_content(
                model=m_name,
                contents=prompt,
            )
            response = await asyncio.wait_for(call_coro, timeout=3.5)
            if response and response.text:
                cleaned = response.text.strip()
                match = re.search(r'\{.*\}', cleaned, re.DOTALL)
                if match:
                    parsed = json.loads(match.group(0))
                    e_title = parsed.get("enhanced_title", "").strip() or fallback_title
                    e_msg = parsed.get("enhanced_message", "").strip() or fallback_message
                    return AnnouncementAiEnhanceResponse(
                        enhanced_title=e_title,
                        enhanced_message=e_msg,
                    )
        except Exception as e:
            print(f"Announcement AI enhance error with {m_name}: {e}")
            continue

    return AnnouncementAiEnhanceResponse(
        enhanced_title=fallback_title,
        enhanced_message=fallback_message,
    )
