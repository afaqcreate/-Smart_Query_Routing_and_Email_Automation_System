from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import oauth
from app.api.routes.escalation import escalation
from app.api.routes.message import message
from app.api.routes.query import query
from app.api.routes.route import router
from app.api.routes.user import user
from app.api.routes.admin import admin
from app.api.routes.automation import automat
from app.config import FRONTEND_ORIGIN
from app.database.base import Base
from app.database.connection import engine
# Import models so SQLAlchemy registers every table before create_all.
from app.models import table as _models  # noqa: F401

app = FastAPI(
    title="Student Query Management API",
    version="1.0.0",
    description="Backend API for university query management and routing.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_ORIGIN,
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        
    ],
    allow_credentials=True,
    allow_methods=["DELETE", "POST", "GET", "OPTIONS", "PATCH"], 
    allow_headers=["Authorization", "Content-Type"],
)

# Convenient for local development. Use Alembic migrations in production.
Base.metadata.create_all(bind=engine)

app.include_router(oauth)
app.include_router(user)
app.include_router(query)
app.include_router(router)
app.include_router(escalation)
app.include_router(admin)
app.include_router(automat)
app.include_router(message)


@app.get("/", tags=["Root"])
def root():
    return {
        "status": "healthy",
        "message": "Student Query Management API is running.",
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
