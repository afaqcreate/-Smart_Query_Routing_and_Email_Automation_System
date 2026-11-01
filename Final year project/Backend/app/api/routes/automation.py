from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from google.genai import errors
from app.config import client
from app.database.connection import get_db
from app.services.AiQueryRoute import save_query_to_db
from app.schemas.subschemas import QueryResponse, QueryPayload

automat = APIRouter(prefix="/api", tags=["Ai Automation"])


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

# Set a valid default department as a fallback
    assigned_department = "Admin"

    valid_departments = [
        "Admin",
        "Instructor",
        "IT Department",
        "Finance Department",
        "Registrar Department",
        "Exam Department",
        "Head Of Department",
        "General",  # <-- Include it here if you want to keep "General"
    ]

    try:
      response = client.models.generate_content(
          model='gemini-3.6-flash',
          contents=prompt,
      )

      if response.text:
        cleaned_dept = response.text.strip()
        if cleaned_dept in valid_departments:
          assigned_department = cleaned_dept

    except errors.APIError as e:
      print(f"Gemini API Error: {e}")
    except Exception as e:
      print(f"Unexpected error during AI routing: {e}")

    saved_query = save_query_to_db(db, payload, assigned_department)
    return saved_query