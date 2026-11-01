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


DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
REDIRECT_URI = os.getenv("REDIRECT_URI", "http://127.0.0.1:8000/api/auth/google/callback").strip()
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://127.0.0.1:5500").strip().rstrip("/")

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
