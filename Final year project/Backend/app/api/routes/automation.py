import asyncio
import json
import re
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from google.genai import errors
from app.config import client
from app.database.connection import get_db
from app.services.AiQueryRoute import save_query_to_db
from app.schemas.subschemas import QueryResponse, QueryPayload
from app.models.table import Query
from app.services.leave_ai import sanitize_chat_message

automat = APIRouter(prefix="/api", tags=["Ai Automation"])


class SuggestionItem(BaseModel):
    title: str
    text: str


class DraftReplyRequest(BaseModel):
    query_id: Optional[int] = None
    query_subject: Optional[str] = "Student Query"
    query_body: Optional[str] = ""
    category: Optional[str] = "General"
    student_name: Optional[str] = "Student"
    staff_role: Optional[str] = "Staff"
    staff_name: Optional[str] = None


class DraftReplyResponse(BaseModel):
    primary_draft: str
    suggestions: List[SuggestionItem]


@automat.post("/query/ai", response_model=QueryResponse, status_code=status.HTTP_200_OK)
async def create_and_route_query(payload: QueryPayload, db: Session = Depends(get_db)):
    
    prompt = f"""
    You are an automated university desk routing assistant. Analyze the student query below and classify it into EXACTLY ONE of the following departments:
    - Admin
    - IT Department
    - Finance Department
    - Registrar Department
    - Exam Department
    - Instructor
    - Head Of Department
    - General

    Subject: {payload.query_subject}
    Description: {payload.query_body}

    Return ONLY the department name, with no extra text or punctuation.
    """

    assigned_department = "Admin"

    valid_departments = [
        "Admin",
        "Instructor",
        "IT Department",
        "Finance Department",
        "Registrar Department",
        "Exam Department",
        "Head Of Department",
        "General",  
    ]

    for m_name in ['gemini-3.5-flash-lite', 'gemini-3-flash-preview']:
        try:
            call_coro = client.aio.models.generate_content(
                model=m_name,
                contents=prompt,
            )
            response = await asyncio.wait_for(call_coro, timeout=3.5)
            if response and response.text:
                cleaned_dept = response.text.strip().replace('"', '').replace("'", "")
                for vd in valid_departments:
                    if vd.lower() == cleaned_dept.lower():
                        assigned_department = vd
                        break
                if assigned_department in valid_departments and assigned_department != "Admin":
                    break
        except errors.APIError as e:
            print(f"Gemini API Error with {m_name}: {e}")
            continue
        except Exception as e:
            print(f"Unexpected error during AI routing with {m_name}: {e}")
            continue

    saved_query = await save_query_to_db(db, payload, assigned_department)
    return saved_query


@automat.post("/query/ai-draft-reply", response_model=DraftReplyResponse)
@automat.post("/query/{query_id}/ai-draft-reply", response_model=DraftReplyResponse)
async def generate_ai_draft_reply(
    query_id: Optional[int] = None,
    payload: Optional[DraftReplyRequest] = None,
    db: Session = Depends(get_db)
):
    if payload is None:
        payload = DraftReplyRequest()
        
    target_qid = query_id or payload.query_id
    subject = payload.query_subject or "Student Query"
    body = payload.query_body or ""
    category = payload.category or "General"
    student_name = payload.student_name or "Student"
    staff_role = payload.staff_role or "Staff"
    staff_name = payload.staff_name or staff_role

    recent_messages_context = ""
    if target_qid:
        q_record = db.query(Query).filter(Query.query_id == target_qid).first()
        if q_record:
            if not body and q_record.query_body:
                body = q_record.query_body
            if (subject == "Student Query" or not subject) and q_record.query_subject:
                subject = q_record.query_subject
            if q_record.category:
                category = q_record.category
            if q_record.student and q_record.student.name:
                student_name = q_record.student.name
            if q_record.messages:
                last_msgs = [f"- {m.sender_role}: {m.message_body}" for m in q_record.messages[-3:]]
                recent_messages_context = "\nRecent Messages:\n" + "\n".join(last_msgs)

    fallback_suggestions = [
        SuggestionItem(
            title="Detailed Guidance",
            text=f"Regarding your query on '{subject}', we've checked the details. Please follow standard procedures or reach out if you need more help with this."
        ),
        SuggestionItem(
            title="Review / In-Progress",
            text=f"We received your inquiry regarding '{subject}'. Our {staff_role} team is actively reviewing your request and will update you shortly."
        ),
        SuggestionItem(
            title="Issue Resolved",
            text=f"Your request regarding '{subject}' has been processed and resolved. Please let us know if you need anything else."
        )
    ]

    prompt = f"""You are an expert university staff communication assistant for {staff_role}.
Generate 3 distinct, professional, and helpful draft chat reply suggestions for a student query in an instant messaging chat box.

CONTEXT:
Student Name: {student_name}
Staff Role: {staff_role} ({staff_name})
Category/Department: {category}
Query Subject: {subject}
Query Description: {body}
{recent_messages_context}

STRICT FORMAT RULES:
1. DO NOT USE EMAIL FORMATTING:
   - Absolutely NO "Dear [Name]", NO "Hello [Name]", NO "Hi [Name]", and NO letter salutations.
   - Absolutely NO "Best regards", NO "Sincerely", NO "Regards", NO "Thanks", and NO sign-off signatures or name blocks (e.g. do not sign with "{staff_name}" or "({staff_role})").
   - These are direct chat bubble messages (like Slack or WhatsApp), NOT email letters.
2. ANSWER ACCORDING TO THE STUDENT'S SPECIFIC INQUIRY:
   - Analyze what the student specifically asked in the query description and recent messages.
   - Address their exact question or issue directly with concrete guidance or answers.
3. Keep each suggestion concise (2 to 3 direct sentences, natural chat tone).

GENERATE 3 SUGGESTIONS:
1. "Detailed Guidance": A direct, helpful answer addressing the student's question and situation specifically with clear instructions.
2. "Review / In-Progress": An acknowledgment confirming receipt of their specific request, noting it is under active review by {staff_role}.
3. "Issue Resolved": A clear confirmation stating the specific matter is resolved or what final steps were completed.

Return ONLY a valid JSON object with this exact structure:
{{
  "primary_draft": "full text of the most recommended reply",
  "suggestions": [
    {{"title": "Detailed Guidance", "text": "..."}},
    {{"title": "Review / In-Progress", "text": "..."}},
    {{"title": "Issue Resolved", "text": "..."}}
  ]
}}"""

    model_candidates = ['gemini-3.5-flash-lite', 'gemini-3-flash-preview']
    for m_name in model_candidates:
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
                    sugs = []
                    for s in parsed.get("suggestions", []):
                        if s.get("title") and s.get("text"):
                            sugs.append(SuggestionItem(
                                title=s["title"],
                                text=sanitize_chat_message(s["text"])
                            ))
                    primary = parsed.get("primary_draft")
                    if primary:
                        primary = sanitize_chat_message(primary)
                    elif sugs:
                        primary = sugs[0].text
                    else:
                        primary = fallback_suggestions[0].text

                    if sugs:
                        return DraftReplyResponse(primary_draft=primary, suggestions=sugs)
        except Exception as e:
            print(f"Model candidate {m_name} failed: {e}")
            continue

    return DraftReplyResponse(
        primary_draft=fallback_suggestions[0].text,
        suggestions=fallback_suggestions
    )
