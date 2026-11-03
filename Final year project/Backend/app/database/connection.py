from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import DATABASE_URL

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is missing. Please set DATABASE_URL in your environment or .env file."
    )

# Production-optimized connection engine for Supabase & PostgreSQL
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,       # Verifies connection liveness before executing queries
    pool_recycle=300,         # Recycles idle pool connections every 5 minutes to prevent EOF drops
    pool_size=10,             # Keep up to 10 connections in pool
    max_overflow=20,          # Allow up to 20 burst connections under heavy traffic
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
