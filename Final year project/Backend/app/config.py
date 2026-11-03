import os
from pathlib import Path
from google import genai
from google.genai import errors

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(
            f"Missing required environment variable {name}. "
            "Copy .env.example to .env and configure it."
        )
    return value


raw_db_url = os.getenv("DATABASE_URL", "").strip()
# Normalize legacy or cloud pooler prefixes (e.g. postgres:// to postgresql:// for SQLAlchemy 2.0)
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)
DATABASE_URL = raw_db_url

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
REDIRECT_URI = os.getenv("REDIRECT_URI", "http://127.0.0.1:8000/api/auth/google/callback").strip()

# Support multiple allowed origins (comma-separated or single)
raw_frontend = os.getenv("FRONTEND_ORIGINS") or os.getenv("FRONTEND_ORIGIN", "http://127.0.0.1:5500")
ALLOWED_ORIGINS = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
for item in raw_frontend.split(","):
    cleaned = item.strip().rstrip("/")
    if cleaned and cleaned not in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS.append(cleaned)

FRONTEND_ORIGIN = ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "http://127.0.0.1:5500"

gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
try:
    client = genai.Client(api_key=gemini_key) if gemini_key else None
except Exception as e:
    print(f"[WARNING] Gemini client initialization error: {e}")
    client = None
