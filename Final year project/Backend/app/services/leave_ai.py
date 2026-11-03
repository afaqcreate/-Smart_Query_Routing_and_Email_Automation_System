import asyncio
import re
from typing import Optional
from app.config import client


def sanitize_chat_message(text: str) -> str:
    """
    Sanitizes AI-generated text to ensure it strictly follows modern instant messaging /
    chat bubble style, removing any email salutations, letter greetings, and sign-offs.
    """
    cleaned = (text or "").strip().strip('"').strip("'")
    # Remove leading email greetings like "Dear Student,", "Hello [Name],", "Hi [Name],"
    cleaned = re.sub(r'^(Dear|Hello|Hi)\s+[^,\n]+[,:\n]+', '', cleaned, flags=re.IGNORECASE).strip()
    # Remove trailing sign-offs like "Best regards,...", "Sincerely,...", "Regards,...", "Thanks,..."
    cleaned = re.sub(r'\n+(Best regards|Warm regards|Kind regards|Sincerely|Regards|Thanks|Cheer[s]?)[,\s\S]*$', '', cleaned, flags=re.IGNORECASE).strip()
    # Remove any markdown bold wrapper around the whole text
    cleaned = re.sub(r'^\*\*(.*?)\*\*$', r'\1', cleaned, flags=re.DOTALL).strip()
    return cleaned


async def generate_instructor_ai_leave_reply(
    instructor_name: Optional[str] = "Instructor",
    leave_start: Optional[str] = None,
    leave_end: Optional[str] = None,
    leave_reason: Optional[str] = None,
    custom_guidance: Optional[str] = None,
    student_name: Optional[str] = "Student",
    query_subject: Optional[str] = "Course Inquiry",
    student_message: Optional[str] = "",
) -> str:
    """
    Generates a contextual, intelligent AI automated out-of-office response
    specifically tailored to what the student asked, formatted as a modern direct chat message
    (no email formatting, no 'Dear ...', no 'Best regards').
    """
    inst_name = (instructor_name or "").strip() or "Instructor"
    stud_name = (student_name or "").strip() or "Student"
    subj = (query_subject or "").strip() or "Course Inquiry"
    msg_body = (student_message or "").strip() or subj
    start_str = (leave_start or "").strip() or "recently"
    end_str = (leave_end or "").strip() or "further notice"
    reason_str = (leave_reason or "").strip() or "official / academic leave"
    guidance_str = (custom_guidance or "").strip() or "For urgent academic or administrative matters, please reach out to the Head of Department."

    fallback_text = (
        f"I am currently away on leave ({reason_str}) until {end_str} with limited access to messages. "
        f"Regarding your query on '{subj}', your message has been logged and will be reviewed upon my return. "
        f"{guidance_str}"
    )

    prompt = f"""You are the automated AI assistant for Instructor {inst_name}, who is currently ON LEAVE.
A student just sent a message in the university chat portal. Your job is to generate a direct, helpful, and natural chat reply that directly answers according to what the student asked, while informing them that the instructor is on leave.

LEAVE INFORMATION:
- Instructor: {inst_name}
- Leave Period: from {start_str} to {end_str}
- Leave Reason: {reason_str}
- Policy / Urgent Guidance: {guidance_str}

STUDENT'S INQUIRY:
- Student Name: {stud_name}
- Query Subject: {subj}
- Student's Message: "{msg_body}"

STRICT INSTRUCTIONS:
1. DO NOT USE EMAIL FORMATTING:
   - Absolutely NO "Dear [Name]", NO "Hello [Name]", NO "Hi [Name]", and NO letter salutations.
   - Absolutely NO "Best regards", NO "Sincerely", NO "Regards", NO "Thanks", and NO sign-off signature blocks (do not end with your name or role).
   - This is a modern instant messaging chat bubble, NOT an email letter.
2. ANSWER ACCORDING TO THE STUDENT'S SPECIFIC INQUIRY:
   - Carefully read the student's message: "{msg_body}".
   - Directly address their specific question or situation with practical advice (e.g., if they asked about an assignment, quiz, exam syllabus, deadline extension, grading, or technical problem, give immediate practical guidance or instructions).
3. EXPLAIN THE INSTRUCTOR'S LEAVE STATUS:
   - Mention concisely that Instructor {inst_name} is currently on leave until {end_str} ({reason_str}).
   - Direct them to the policy or alternate contact ({guidance_str}) for urgent matters.
   - Assure them that their inquiry is recorded and the instructor will follow up upon return if needed.
4. TONE & LENGTH:
   - Natural, conversational chat tone.
   - 2 to 4 sentences (under 80 words).
   - Return ONLY the direct message text. No quotation marks, no markdown headings, no bullet points."""

    for m_name in ["gemini-3.5-flash-lite", "gemini-3-flash-preview"]:
        try:
            call_coro = client.aio.models.generate_content(
                model=m_name,
                contents=prompt,
            )
            response = await asyncio.wait_for(call_coro, timeout=3.5)
            if response and response.text:
                cleaned = sanitize_chat_message(response.text)
                if len(cleaned) > 25:
                    return cleaned
        except Exception as e:
            print(f"AI Leave auto-reply error with {m_name}: {e}")
            continue

    return fallback_text
